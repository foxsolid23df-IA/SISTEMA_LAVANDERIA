import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AUTO_CANCEL_VERSION = "auto-cancel-v1-20260709";

// ── Phone helpers ────────────────────────────────────────────────
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
      console.error(`[AutoCancel] Error sending message: ${res.status} - ${errorText}`);
      return false;
    }
    console.log(`[AutoCancel] Cancellation notice sent to ${phone}`);
    return true;
  } catch (e) {
    console.error("[AutoCancel] Network error sending message:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log(`[AutoCancel ${AUTO_CANCEL_VERSION}] Starting auto-cancellation check...`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";

    // 1. Find all stores with delivery enabled
    const { data: stores, error: storesError } = await supabase
      .from("profiles")
      .select("id, store_name, whatsapp_session_token, whatsapp_gateway_type")
      .eq("delivery_enabled", true);

    if (storesError || !stores || stores.length === 0) {
      console.log("[AutoCancel] No stores with delivery enabled found.");
      return new Response(
        JSON.stringify({ processed: 0, message: "No stores to process" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalCancelled = 0;
    let totalNotified = 0;
    const results: { storeId: string; storeName: string; cancelled: number; notified: number }[] = [];

    for (const store of stores) {
      try {
        // 2. Find stale orders (older than 24h, still requested, not yet quoted)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: staleOrders, error: ordersError } = await supabase
          .from("delivery_orders")
          .select("id, customer_name, customer_phone, created_at")
          .eq("user_id", store.id)
          .eq("status", "requested")
          .is("pickup_quote_confirmed_at", null)
          .lt("created_at", twentyFourHoursAgo);

        if (ordersError || !staleOrders || staleOrders.length === 0) {
          continue;
        }

        console.log(`[AutoCancel] Store ${store.store_name}: ${staleOrders.length} stale orders to cancel.`);

        let storeCancelled = 0;
        let storeNotified = 0;

        for (const order of staleOrders) {
          try {
            // 3. Cancel the order
            const { error: cancelError } = await supabase
              .from("delivery_orders")
              .update({
                status: "cancelled",
                cancelled_at: new Date().toISOString(),
              })
              .eq("id", order.id)
              .eq("user_id", store.id)
              .eq("status", "requested");

            if (cancelError) {
              console.error(`[AutoCancel] Error cancelling order ${order.id}:`, cancelError);
              continue;
            }

            storeCancelled++;

            // 4. Notify customer (best effort)
            if (store.whatsapp_session_token) {
              const message = `Hola ${order.customer_name}! Tu solicitud de recogida en *${store.store_name}* ha sido cancelada automáticamente porque no se confirmó en 24 horas.\n\nSi aún deseas el servicio, por favor escríbenos de nuevo y con gusto te atendemos.`;

              const sent = await sendWhatsAppText(
                EVOLUTION_API_URL,
                store.whatsapp_session_token,
                store.whatsapp_session_token,
                order.customer_phone,
                message
              );

              if (sent) storeNotified++;

              // Log the notification
              await supabase.from("delivery_notification_logs").insert([{
                user_id: store.id,
                delivery_order_id: order.id,
                recipient_type: "customer",
                recipient_phone: order.customer_phone,
                event_type: "auto_cancelled",
                gateway: "whatsapp_auto_cancel",
                success: sent,
                error: sent ? null : "Failed to send auto-cancel notification",
                payload: { reason: "stale_order_24h", order_created: order.created_at },
              }]);
            }
          } catch (err) {
            console.error(`[AutoCancel] Error processing order ${order.id}:`, err);
          }
        }

        totalCancelled += storeCancelled;
        totalNotified += storeNotified;
        results.push({
          storeId: store.id,
          storeName: store.store_name || "Unknown",
          cancelled: storeCancelled,
          notified: storeNotified,
        });
      } catch (err) {
        console.error(`[AutoCancel] Error processing store ${store.id}:`, err);
      }
    }

    console.log(`[AutoCancel] Done. Total cancelled: ${totalCancelled}, notified: ${totalNotified}`);

    return new Response(
      JSON.stringify({
        version: AUTO_CANCEL_VERSION,
        total_cancelled: totalCancelled,
        total_notified: totalNotified,
        stores_processed: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[AutoCancel] Critical error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
