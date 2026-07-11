import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find conversations stuck in awaiting_client_approval without reminder sent
    const { data: conversations, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select(`
        id,
        user_id,
        customer_phone,
        customer_name,
        context,
        last_message_at,
        profiles:user_id (store_name, whatsapp_session_token, whatsapp_gateway_type)
      `)
      .eq("current_state", "awaiting_client_approval")
      .is("context->>reminder_sent", null)
      .not("last_message_at", "is", null);

    if (convError) {
      console.error("Error fetching conversations:", convError);
      return new Response(JSON.stringify({ error: "DB error" }), { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No reminders pending" }));
    }

    let processed = 0;
    const results = [];

    for (const conv of conversations) {
      try {
        // Check store delivery settings for reminder timing
        const { data: settings } = await supabase
          .from("store_delivery_settings")
          .select("auto_reminder_enabled, reminder_minutes")
          .eq("user_id", conv.user_id)
          .single();

        // Skip if reminders disabled for this store
        if (settings && !settings.auto_reminder_enabled) {
          continue;
        }

        const reminderMinutes = settings?.reminder_minutes || 30;
        const lastMessage = new Date(conv.last_message_at);
        const now = new Date();
        const diffMs = now.getTime() - lastMessage.getTime();
        const diffMin = diffMs / 60000;

        // Only send if enough time has passed
        if (diffMin < reminderMinutes) {
          continue;
        }

        const orderId = conv.context?.pending_approval_order_id;
        const quotedFee = conv.context?.quoted_fee || 0;
        const quotedServiceCost = conv.context?.quoted_service_cost || 0;
        const total = Number(quotedFee) + Number(quotedServiceCost);
        const storeName = (conv.profiles as any)?.store_name || "Nuestra lavandería";
        const customerName = conv.customer_name || "Cliente";

        const reminderMsg = `Hola ${customerName}, aún tienes una cotización pendiente de *${storeName}*.\n\n💰 Total estimado: $${total.toFixed(2)} MXN\n\n¿Aceptas? Responde *SI* o *NO*`;

        // Send via the store's WhatsApp gateway
        const profile = conv.profiles as any;
        if (profile?.whatsapp_session_token) {
          // QR-linked mode via Evolution API
          const evoUrl = Deno.env.get("EVOLUTION_API_URL") || "https://catechisable-berniece-unpersonalised.ngrok-free.dev";
          const apiKey = Deno.env.get("EVOLUTION_API_KEY") || "ClavePruebaSaaS2026";
          const instanceName = profile.whatsapp_session_token;

          await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": apiKey,
            },
            body: JSON.stringify({
              number: conv.customer_phone,
              text: reminderMsg,
            }),
          });
        }

        // Mark reminder as sent
        await supabase
          .from("whatsapp_conversations")
          .update({
            context: { ...conv.context, reminder_sent: true, reminder_sent_at: now.toISOString() },
          })
          .eq("id", conv.id);

        processed++;
        results.push({ phone: conv.customer_phone, order_id: orderId });
      } catch (err) {
        console.error(`Error processing reminder for ${conv.customer_phone}:`, err);
      }
    }

    return new Response(JSON.stringify({ processed, results }));
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
