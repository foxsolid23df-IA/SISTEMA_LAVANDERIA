import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERSION = "ready-reminders-v2-20260710";

const DEFAULT_TEMPLATES: Record<string, string> = {
  "1": "Hola {customer_name}! Tu ropa ya esta lista para recoger en *{store_name}*. Orden #{order_folio}. Te esperamos!",
  "2": "Hola {customer_name}! Recordatorio: tu ropa lleva 24h lista en *{store_name}*. Orden #{order_folio}. Pasa a recogerla cuando puedas.",
  "3": "Hola {customer_name}! Tu pedido #{order_folio} lleva 2 dias listo en *{store_name}*. Por favor indicanos si pasaras a recogerlo o que hacemos con el. Gracias!",
};

function renderTemplate(template: string, vars: Record<string, string>) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

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

async function resolveEvolutionPhone(
  baseUrl: string,
  instance: string,
  apikey: string | null,
  candidates: string[],
) {
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

async function sendWhatsAppMessage(
  rawPhone: string,
  message: string,
  profile: any,
): Promise<{ success: boolean; gateway: string; error: string | null; sentTo?: string }> {
  const phoneCandidates = getPhoneCandidates(rawPhone);
  if (phoneCandidates.length === 0) {
    return { success: false, gateway: "none", error: "Telefono destino vacio." };
  }

  let phone = phoneCandidates[0];
  const gatewayType = profile?.whatsapp_gateway_type || "central_saas";
  const sessionToken = profile?.whatsapp_session_token || null;
  const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
  const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME") || Deno.env.get("WHATSAPP_INSTANCE_NAME") || "default";
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
  const twilioWhatsappNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "";

  let errorLog = "";

  if (gatewayType === "qr_linked" && sessionToken) {
    try {
      phone = await resolveEvolutionPhone(evolutionApiUrl, evolutionInstance, sessionToken, phoneCandidates);
      const res = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": sessionToken,
        },
        body: JSON.stringify({ number: phone, text: message, delay: 5000 }),
      });

      if (res.ok) {
        return { success: true, gateway: "whatsapp_qr_linked", error: null, sentTo: phone };
      }
      const errorText = await res.text();
      errorLog = `Error Gateway QR: ${res.status} ${errorText}`;
    } catch (err: any) {
      errorLog = `Falla de red en Gateway QR: ${err.message}`;
    }
  }

  if (gatewayType === "central_saas" && twilioAccountSid && twilioAuthToken && twilioWhatsappNumber) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
      const params = new URLSearchParams();
      params.append("To", `whatsapp:+${phone}`);
      params.append("From", twilioWhatsappNumber);
      params.append("Body", message);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (res.ok) {
        return { success: true, gateway: "whatsapp_central_saas", error: null, sentTo: phone };
      }
      const resData = await res.json();
      errorLog = `Error Twilio WhatsApp: ${resData.message || res.statusText}`;
    } catch (err: any) {
      errorLog = `Falla en Twilio WhatsApp: ${err.message}`;
    }
  }

  if (gatewayType === "sms_only" || errorLog !== "") {
    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
        const params = new URLSearchParams();
        params.append("To", `+${phone}`);
        params.append("From", twilioPhoneNumber);
        params.append("Body", message.replace(/\*/g, ""));

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        if (res.ok) {
          return { success: true, gateway: "sms_fallback", error: null, sentTo: phone };
        }
        const resData = await res.json();
        errorLog = `Error Twilio SMS: ${resData.message || res.statusText}`;
      } catch (err: any) {
        errorLog = `Falla de red en Twilio SMS: ${err.message}`;
      }
    } else if (!errorLog) {
      errorLog = "Credenciales de Twilio SMS no configuradas.";
    }
  }

  return { success: false, gateway: "none", error: errorLog || "No se pudo despachar por ninguna pasarela" };
}

async function logNotification(supabase: any, entry: Record<string, unknown>) {
  try {
    const { error } = await supabase
      .from("delivery_notification_logs")
      .insert([entry]);
    if (error) {
      console.warn("[ready-reminders] No se pudo guardar log:", error);
    }
  } catch (err) {
    console.warn("[ready-reminders] Error registrando log:", err);
  }
}

async function processSingleOrder(supabase: any, order: any) {
  const { id: orderId, user_id, customer_id, folio, ready_at, ready_reminder_stage } = order;

  const { data: customer } = await supabase
    .from("customers")
    .select("name, phone")
    .eq("id", customer_id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (!customer || !customer.phone) {
    console.log(`[ready-reminders] Orden #${orderId}: sin cliente o telefono, saltando.`);
    return null;
  }

  const { data: businessSettings } = await supabase
    .from("business_settings")
    .select("ready_notifications_enabled, ready_msg_template_1, ready_msg_template_2, ready_msg_template_3")
    .eq("user_id", user_id)
    .maybeSingle();

  if (!businessSettings?.ready_notifications_enabled) {
    console.log(`[ready-reminders] Orden #${orderId}: notificaciones desactivadas para tienda, saltando.`);
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, store_name, whatsapp_gateway_type, whatsapp_session_token")
    .eq("id", user_id)
    .maybeSingle();

  if (!profile) {
    console.log(`[ready-reminders] Orden #${orderId}: perfil de tienda no encontrado, saltando.`);
    return null;
  }

  if (!profile.whatsapp_session_token && !Deno.env.get("TWILIO_ACCOUNT_SID")) {
    console.log(`[ready-reminders] Orden #${orderId}: sin configuracion de WhatsApp, saltando.`);
    return null;
  }

  const storeName = profile.store_name || "Nuestra lavanderia";
  const customerName = customer.name || "Cliente";
  const orderFolio = folio ? String(folio) : String(orderId);

  const defaultTemplate1 = businessSettings?.ready_msg_template_1 || DEFAULT_TEMPLATES["1"];
  const defaultTemplate2 = businessSettings?.ready_msg_template_2 || DEFAULT_TEMPLATES["2"];
  const defaultTemplate3 = businessSettings?.ready_msg_template_3 || DEFAULT_TEMPLATES["3"];

  const templateVars = { customer_name: customerName, store_name: storeName, order_folio: orderFolio };

  const now = new Date();
  const readyDate = new Date(ready_at);
  const hoursSinceReady = (now.getTime() - readyDate.getTime()) / (1000 * 60 * 60);

  let stage: string | null = ready_reminder_stage || null;
  let message = "";
  let eventType = "";

  // Stage machine: mensaje 1 (0h) → mensaje 2 (24h) → mensaje 3 (48h)
  // 24 horas entre cada recordatorio
  if (stage === null) {
    if (hoursSinceReady < 24) {
      message = renderTemplate(defaultTemplate1, templateVars);
      eventType = "ready_reminder_1";
      stage = "first";
    } else if (hoursSinceReady >= 24 && hoursSinceReady < 48) {
      message = renderTemplate(defaultTemplate2, templateVars);
      eventType = "ready_reminder_2";
      stage = "second";
    } else if (hoursSinceReady >= 48) {
      message = renderTemplate(defaultTemplate3, templateVars);
      eventType = "ready_reminder_3";
      stage = "third";
    }
  } else if (stage === "first") {
    if (hoursSinceReady >= 24 && hoursSinceReady < 48) {
      message = renderTemplate(defaultTemplate2, templateVars);
      eventType = "ready_reminder_2";
      stage = "second";
    } else if (hoursSinceReady >= 48) {
      message = renderTemplate(defaultTemplate3, templateVars);
      eventType = "ready_reminder_3";
      stage = "third";
    }
  } else if (stage === "second") {
    if (hoursSinceReady >= 48) {
      message = renderTemplate(defaultTemplate3, templateVars);
      eventType = "ready_reminder_3";
      stage = "third";
    }
  } else if (stage === "third") {
    return null;
  }

  if (!message) return null;

  const result = await sendWhatsAppMessage(customer.phone, message, profile);

  await supabase
    .from("orders")
    .update({
      ready_reminder_stage: stage,
      last_ready_reminder_at: now.toISOString(),
    })
    .eq("id", orderId);

  await logNotification(supabase, {
    user_id,
    delivery_order_id: null,
    recipient_type: "customer",
    recipient_phone: customer.phone,
    event_type: eventType,
    gateway: result.gateway,
    success: result.success,
    error: result.error,
    sent_to: result.sentTo || null,
    payload: { order_id: orderId, stage, folio: orderFolio, version: VERSION },
  });

  return { orderId, stage, success: result.success, gateway: result.gateway };
}

async function handleImmediate(supabase: any, orderId: number) {
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("status", "ready")
    .maybeSingle();

  if (!order) {
    return { error: `Orden #${orderId} no encontrada o no esta en estado ready` };
  }

  if (order.ready_reminder_stage !== null) {
    return { message: `Orden #${orderId}: notificacion ya enviada (stage: ${order.ready_reminder_stage})` };
  }

  const result = await processSingleOrder(supabase, order);
  return { orderId, result };
}

async function handleCron(supabase: any) {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "ready")
    .not("ready_at", "is", null)
    .is("deleted_at", null)
    .order("ready_at", { ascending: true });

  if (error) {
    console.error("[ready-reminders] Error fetching orders:", error);
    return { error: "Database error", details: error };
  }

  if (!orders || orders.length === 0) {
    return { processed: 0, message: "No hay ordenes listas pendientes" };
  }

  let sent = 0;
  let skipped = 0;
  const results = [];

  for (const order of orders) {
    try {
      const res = await processSingleOrder(supabase, order);
      if (res) {
        sent++;
        results.push(res);
      } else {
        skipped++;
      }
    } catch (err: any) {
      console.error(`[ready-reminders] Error procesando orden #${order.id}:`, err);
      skipped++;
    }
  }

  return { processed: orders.length, sent, skipped, results };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const { trigger, order_id } = body;

    console.log(`[ready-reminders ${VERSION}] trigger=${trigger}, order_id=${order_id || "N/A"}`);

    let responseData: any;

    if (trigger === "ready" && order_id) {
      responseData = await handleImmediate(supabase, order_id);
    } else if (trigger === "cron") {
      responseData = await handleCron(supabase);
    } else {
      return new Response(
        JSON.stringify({ error: "trigger requerido: 'ready' (con order_id) o 'cron'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ version: VERSION, ...responseData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[ready-reminders] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
