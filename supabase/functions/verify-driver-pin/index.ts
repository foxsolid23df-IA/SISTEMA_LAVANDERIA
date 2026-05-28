import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getAuthUser = async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const authHeader = req.headers.get("Authorization") || "";
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const signDriverSession = async (storeId: string, driverId: number) => {
  const issuedAt = Date.now();
  const payload = `${storeId}.${driverId}.${issuedAt}`;
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${toHex(signature)}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido." }, 405);
  }

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return jsonResponse({ error: "Usuario no autenticado." }, 401);
    }

    const body = await req.json();
    const pin = String(body?.pin || "").trim();
    if (!/^\d{4,8}$/.test(pin)) {
      return jsonResponse({ error: "PIN invalido." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await supabase
      .from("profiles")
      .select("delivery_enabled")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.delivery_enabled !== true) {
      return jsonResponse({ error: "Modulo delivery no disponible." }, 403);
    }

    const { data: driver, error } = await supabase
      .from("staff")
      .select("id, name, role, phone, active, user_id")
      .eq("user_id", user.id)
      .eq("pin", pin)
      .eq("active", true)
      .in("role", ["repartidor", "chofer"])
      .maybeSingle();

    if (error) {
      console.error("[verify-driver-pin] Error validando PIN:", error);
      return jsonResponse({ error: "No se pudo validar el PIN." }, 500);
    }

    if (!driver) {
      return jsonResponse({ error: "PIN incorrecto o repartidor inactivo." }, 403);
    }

    return jsonResponse({
      driver: {
        id: driver.id,
        name: driver.name,
        role: driver.role,
        phone: driver.phone,
        session_token: await signDriverSession(user.id, Number(driver.id)),
      },
    });
  } catch (err) {
    console.error("[verify-driver-pin] Error inesperado:", err);
    return jsonResponse({ error: "Error interno validando PIN." }, 500);
  }
});
