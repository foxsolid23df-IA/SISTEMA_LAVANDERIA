import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REMINDER_VERSION = "abandoned-reminder-v1-20260709";

// ── Template helper ──────────────────────────────────────────────
function renderTemplate(template: string, vars: Record<string, string>) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

// ── Phone helpers (same as other functions) ──────────────────────
function getPhoneCandidates(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return [];
  if (digits.length === 10) return [`521${digits}`, `52${digits}`, digits];
  if (digits.length === 12 && digits.startsWith("52")) return [`521${digits.slice(2)}`, digits, digits.slice(2)];
  if (digits.length === 13 && digits.startsWith("521")) return [digits, `52${digits.slice(3)}`, digits.slice(3)];
  return [digits];
}

function looksWhatsappNumberAvailable(entry: any) {
  return entry?.exists === true || entry?.numberExists === true || entry?.isWhatsapp === true || entry?.jid || entry?.status === "exists";
}

async function resolveEvolutionPhone(baseUrl: string, instance: string, apikey: string | null, candidates: string[]) {
  if (candidates.length <= 1) return candidates[0] || "";
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apikey) headers["apikey"] = apikey;
    const res = await fetch(`${baseUrl}/chat/whatsappNumbers/${instance}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ numbers: candidates }),
    });
    if (!res.ok) return candidates[0];
    const data = await res.json();
    const rows = Array.isArray(data) ? data : data?.numbers || data?.data || [];
    const match = rows.find((row: any) => looksWhatsappNumberAvailable(row));
    return match?.number || match?.remoteJid?.split("@")?.[0] || match?.jid?.split("@")?.[0] || candidates[0];
  } catch {
    return candidates[0];
  }
}

async function sendWhatsAppText(baseUrl: string, instance: string, apikey: string | null, number: string, text: string) {
  try {
    const phoneCandidates = getPhoneCandidates(number);
    if (phoneCandidates.length === 0) return false;
    const phone = await resolveEvolutionPhone(baseUrl, instance, apikey, phoneCandidates);
    const url = `${baseUrl}/message/sendText/${instance}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apikey) headers["apikey"] = apikey;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ number: phone, text, delay: 1200 }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Reminder] Error sending message: ${res.status} - ${errorText}`);
      return false;
    }
    console.log(`[Reminder] Message sent to ${phone}`);
    return true;
  } catch (e) {
    console.error("[Reminder] Network error sending message:", e);
    return false;
  }
}

// ── State labels for messages ────────────────────────────────────
const getStateHelpMessage = (state: string, customerName: string, storeName: string): string | null => {
  switch (state) {
    case "awaiting_address":
      return `Hola ${customerName}! 👋 Soy de *${storeName}*. Notamos que nos enviaste tu solicitud de recogida pero aún no nos comparten tu dirección.\n\n¿Podrías enviarnos tu dirección o ubicación por favor? Así podemos coordinar la recogida de tu ropa.`;
    case "awaiting_zone":
      return `Hola ${customerName}! 👋 Soy de *${storeName}*. Para continuar con tu solicitud, necesitamos que nos confirmes en qué zona te encuentras.\n\nResponde con el número de tu zona o escribe *menu* para empezar de nuevo.`;
    case "awaiting_pickup_day":
      return `Hola ${customerName}! 👋 Soy de *${storeName}*. Ya casi listo tu pedido. Solo falta que nos digas qué día prefieres para la recogida.\n\nResponde con el día de la semana o escribe *menu* para volver al inicio.`;
    case "awaiting_garments":
      return `Hola ${customerName}! 👋 Soy de *${storeName}*. Para darte una cotización, necesitamos saber qué prendas vas a llevar.\n\nDescríbenos tus prendas o escribe *lista* para ver nuestros precios. Escribe *menu* para volver al inicio.`;
    default:
      return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log(`[Reminder ${REMINDER_VERSION}] Starting abandoned conversation check...`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";

    // Find conversations stuck in a non-idle state for more than 2 hours
    // and not reminded in the last 6 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const { data: abandonedConversations, error: fetchError } = await supabase
      .from("whatsapp_conversations")
      .select(`
        id,
        user_id,
        customer_phone,
        customer_name,
        current_state,
        last_message_at,
        last_reminder_at,
        context
      `)
      .in("current_state", ["awaiting_address", "awaiting_zone", "awaiting_pickup_day", "awaiting_garments"])
      .lt("last_message_at", twoHoursAgo)
      .or(`last_reminder_at.is.null,last_reminder_at.lt.${sixHoursAgo}`);

    if (fetchError) {
      console.error("[Reminder] Error fetching conversations:", fetchError);
      return new Response(
        JSON.stringify({ error: "Database error", details: fetchError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!abandonedConversations || abandonedConversations.length === 0) {
      console.log("[Reminder] No abandoned conversations found.");
      return new Response(
        JSON.stringify({ processed: 0, message: "No abandoned conversations to remind" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Reminder] Found ${abandonedConversations.length} abandoned conversations.`);

    let reminded = 0;
    let failed = 0;

    for (const conv of abandonedConversations) {
      try {
        // Get store profile for WhatsApp config and store name
        const { data: profile } = await supabase
          .from("profiles")
          .select("store_name, whatsapp_session_token, whatsapp_gateway_type")
          .eq("id", conv.user_id)
          .single();

        if (!profile || !profile.whatsapp_session_token) {
          console.log(`[Reminder] Skipping conversation ${conv.id}: no WhatsApp config for store ${conv.user_id}`);
          continue;
        }

        const message = getStateHelpMessage(conv.current_state, conv.customer_name, profile.store_name);
        if (!message) {
          console.log(`[Reminder] Skipping conversation ${conv.id}: unknown state ${conv.current_state}`);
          continue;
        }

        // Send reminder
        const sent = await sendWhatsAppText(
          EVOLUTION_API_URL,
          profile.whatsapp_session_token,
          profile.whatsapp_session_token,
          conv.customer_phone,
          message
        );

        // Update last_reminder_at regardless of success to avoid spamming
        await supabase
          .from("whatsapp_conversations")
          .update({ last_reminder_at: new Date().toISOString() })
          .eq("id", conv.id);

        if (sent) {
          reminded++;
          console.log(`[Reminder] Reminder sent to ${conv.customer_name} (${conv.customer_phone}) for state: ${conv.current_state}`);
        } else {
          failed++;
          console.log(`[Reminder] Failed to send reminder to ${conv.customer_name} (${conv.customer_phone})`);
        }
      } catch (err) {
        console.error(`[Reminder] Error processing conversation ${conv.id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        version: REMINDER_VERSION,
        total_abandoned: abandonedConversations.length,
        reminded,
        failed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Reminder] Critical error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
