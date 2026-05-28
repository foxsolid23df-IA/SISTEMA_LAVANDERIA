import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const paymentPreferences = new Set([
  "pay_at_pickup",
  "pay_on_ready_delivery",
  "pay_at_store_pickup",
]);

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido." }, 405);
  }

  try {
    const body = await req.json();
    const token = String(body?.token || "").trim();
    const paymentPreference = String(body?.payment_preference || "").trim();
    const customerItemDescription = String(body?.customer_item_description || "").trim();

    if (!token) {
      return jsonResponse({ error: "Falta token de seguimiento." }, 400);
    }

    if (paymentPreference && !paymentPreferences.has(paymentPreference)) {
      return jsonResponse({ error: "Preferencia de pago invalida." }, 400);
    }

    const updatePayload: Record<string, unknown> = {};
    if (customerItemDescription) {
      updatePayload.customer_item_description = customerItemDescription.slice(0, 2000);
    }

    if (paymentPreference) {
      updatePayload.payment_preference = paymentPreference;
      updatePayload.payment_preference_confirmed_at = new Date().toISOString();
    }

    if (Object.keys(updatePayload).length === 0) {
      return jsonResponse({ error: "No hay datos para actualizar." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: order, error } = await supabase
      .from("delivery_orders")
      .update(updatePayload)
      .eq("tracking_token", token)
      .not("status", "in", '("completed","cancelled")')
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[update-delivery-request] Error actualizando pedido:", error);
      return jsonResponse({ error: "No se pudo actualizar la solicitud." }, 500);
    }

    if (!order) {
      return jsonResponse({ error: "Pedido no encontrado o cerrado." }, 404);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("[update-delivery-request] Error inesperado:", err);
    return jsonResponse({ error: "Error interno actualizando solicitud." }, 500);
  }
});
