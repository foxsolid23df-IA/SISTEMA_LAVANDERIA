import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getLocationMessage(message: any) {
  if (!message) return null;

  return (
    message.locationMessage ||
    message.liveLocationMessage ||
    getLocationMessage(message.ephemeralMessage?.message) ||
    getLocationMessage(message.viewOnceMessage?.message) ||
    getLocationMessage(message.viewOnceMessageV2?.message) ||
    null
  );
}

function buildAddressFromLocation(location: any) {
  if (!location) return null;

  const latitude = Number(location.degreesLatitude ?? location.latitude);
  const longitude = Number(location.degreesLongitude ?? location.longitude);
  const label = location.address || location.name || "Ubicacion enviada por WhatsApp";

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${label} - https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  return label || null;
}

function readTextValue(value: any) {
  if (typeof value === "string") return value.trim();
  if (typeof value?.text === "string") return value.text.trim();
  if (typeof value?.body === "string") return value.body.trim();
  return "";
}

function getIncomingText(message: any): string {
  if (!message) return "";

  const nestedText =
    getIncomingText(message.ephemeralMessage?.message) ||
    getIncomingText(message.viewOnceMessage?.message) ||
    getIncomingText(message.viewOnceMessageV2?.message);

  if (nestedText) return nestedText;

  const candidates = [
    message.conversation,
    message.extendedTextMessage?.text,
    message.imageMessage?.caption,
    message.videoMessage?.caption,
    message.documentMessage?.caption,
    message.textMessage?.text,
    message.text,
    message.buttonsResponseMessage?.selectedDisplayText,
    message.buttonsResponseMessage?.selectedButtonId,
    message.listResponseMessage?.title,
    message.listResponseMessage?.singleSelectReply?.selectedRowId,
  ];

  for (const candidate of candidates) {
    const text = readTextValue(candidate);
    if (text) return text;
  }

  return "";
}

function getPhoneCandidates(rawPhone: string) {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (!digits) return [];

  if (digits.length === 10) {
    return [`521${digits}`, `52${digits}`, digits];
  }

  if (digits.length === 12 && digits.startsWith("52")) {
    return [`521${digits.slice(2)}`, digits, digits.slice(2)];
  }

  if (digits.length === 13 && digits.startsWith("521")) {
    return [digits, `52${digits.slice(3)}`, digits.slice(3)];
  }

  return [digits];
}

function looksWhatsappNumberAvailable(entry: any) {
  return (
    entry?.exists === true ||
    entry?.numberExists === true ||
    entry?.isWhatsapp === true ||
    entry?.jid ||
    entry?.status === "exists"
  );
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
    const matchedNumber = match?.number || match?.remoteJid?.split("@")?.[0] || match?.jid?.split("@")?.[0];

    return matchedNumber || candidates[0];
  } catch (_err) {
    return candidates[0];
  }
}

function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function looksLikeAddress(text: string) {
  const normalized = normalizeText(text);
  if (normalized.length < 8) return false;
  if (/^(hola|buenos dias|buenas tardes|buenas noches|info|informacion|precio|precios)$/i.test(normalized)) return false;
  if (/^(mi\s+)?(direccion|ubicacion)$/i.test(normalized)) return false;
  if (/^(te\s+)?(mando|envio|paso)\s+(mi\s+)?ubicacion$/i.test(normalized)) return false;

  return (
    /\d/.test(normalized) ||
    /(calle|av\.?|avenida|col\.?|colonia|fracc|fraccionamiento|numero|num|#|cp|codigo postal|entre calles|esquina|privada|domicilio|direccion|ubicacion)/i.test(normalized)
  );
}

function extractAddress(payload: any, text: string) {
  const locationAddress = buildAddressFromLocation(getLocationMessage(payload.data?.message));
  if (locationAddress) return locationAddress;

  const cleanText = text.trim();
  const explicitMatch = cleanText.match(/(?:mi\s+)?(?:direccion|direcci\u00f3n|domicilio|ubicacion|ubicaci\u00f3n)\s*(?:es|:|-)?\s+(.+)/i);
  if (explicitMatch?.[1]?.trim()) return explicitMatch[1].trim();

  if (looksLikeAddress(cleanText)) return cleanText;

  return null;
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("store_id");

    if (!storeId) {
      console.error("[Webhook] Falta el parámetro store_id en la URL.");
      return new Response(
        JSON.stringify({ error: "Falta el parámetro store_id en la URL del webhook." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();
    console.log(`[Webhook] Mensaje recibido para store_id: ${storeId}`, JSON.stringify(payload));

    // Validar formato del payload de Evolution API
    if (!payload.data || !payload.data.key) {
      console.log("[Webhook] Payload ignorado: No contiene data o key.");
      return new Response("Ignored invalid payload format", { status: 200 });
    }

    // Evitar bucles: Ignorar si el mensaje fue enviado por el propio número de la tienda
    if (payload.data.key.fromMe === true) {
      console.log("[Webhook] Payload ignorado: Mensaje saliente de la propia tienda (fromMe = true).");
      return new Response("Ignored self message", { status: 200 });
    }

    const customerPhone = payload.data.key.remoteJid.split("@")[0]; // Prefijo celular
    
    // Extracción de mensaje de manera robusta para diferentes formatos de Evolution API.
    const customerMessage = getIncomingText(payload.data.message);

    const customerPushName = payload.data.pushName || "Cliente WhatsApp";
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || payload.instance || "default";

    console.log(`[Webhook] Teléfono: ${customerPhone}, Mensaje: "${customerMessage}", Nombre: ${customerPushName}, Instancia: ${instanceName}`);

    // Inicializar Supabase Client con Service Role para saltar políticas RLS al escribir órdenes
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener los datos de perfil y la configuración de pasarela del comercio
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("store_name, whatsapp_gateway_type, whatsapp_session_token, delivery_enabled")
      .eq("id", storeId)
      .single();

    if (profileError || !profile) {
      console.error(`[Webhook] Error al cargar perfil de sucursal ${storeId}:`, profileError);
      return new Response(
        JSON.stringify({ error: "Sucursal no encontrada." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storeName = profile.store_name || "Gabino PRUEBAS";
    const sessionToken = profile.whatsapp_session_token;
    const deliveryEnabled = profile.delivery_enabled === true;
    
    // Fallback dinámico con la URL de ngrok provista por el usuario
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "https://catechisable-berniece-unpersonalised.ngrok-free.dev";
    console.log(`[Webhook] Usando EVOLUTION_API_URL: ${EVOLUTION_API_URL} para enviar mensaje a la instancia: ${instanceName}`);

    if (!deliveryEnabled) {
      console.log(`[Webhook] Delivery desactivado para store_id ${storeId}. No se creara pedido.`);
      const disabledText = `Hola ${customerPushName}! Por el momento *${storeName}* no tiene activo el servicio de recogida a domicilio por WhatsApp. Por favor contacta directamente a la sucursal.`;

      try {
        await sendWhatsAppText(
          EVOLUTION_API_URL,
          instanceName,
          sessionToken,
          customerPhone,
          disabledText,
        );
      } catch (notifyError) {
        console.warn("[Webhook] No se pudo enviar aviso de delivery desactivado:", notifyError);
      }

      return new Response(
        JSON.stringify({ success: false, reason: "delivery_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── LÓGICA DE EXTRACCIÓN Y RESPUESTA ─────────────────────────────
    
    // Acepta ubicacion de WhatsApp, "Mi direccion es..." y direcciones libres.
    const address = extractAddress(payload, customerMessage);

    if (address) {
      console.log(`[Webhook] Dirección detectada para pedido: "${address}"`);

      // 1. Verificar si el cliente ya existe por número de teléfono
      let customerId = null;
      const { data: existingCustomer, error: customerLookupError } = await supabaseClient
        .from("customers")
        .select("id")
        .eq("phone", customerPhone)
        .eq("user_id", storeId)
        .maybeSingle();

      if (customerLookupError) {
        console.error("[Webhook] Error buscando cliente existente:", customerLookupError);
      }

      if (existingCustomer) {
        customerId = existingCustomer.id;
        console.log(`[Webhook] Cliente existente encontrado con ID: ${customerId}. Actualizando dirección...`);
        // Actualizar dirección si es necesario
        await supabaseClient
          .from("customers")
          .update({ address })
          .eq("id", customerId);
      } else {
        console.log("[Webhook] Creando nuevo cliente en la base de datos...");
        // Registrar nuevo cliente
        const { data: newCustomer, error: insertCustomerErr } = await supabaseClient
          .from("customers")
          .insert([{
            user_id: storeId,
            name: customerPushName,
            phone: customerPhone,
            address
          }])
          .select()
          .single();

        if (insertCustomerErr) {
          console.error("[Webhook] Error registrando nuevo cliente:", insertCustomerErr);
        } else if (newCustomer) {
          customerId = newCustomer.id;
          console.log(`[Webhook] Nuevo cliente creado con ID: ${customerId}`);
        }
      }

      // 2. Insertar pedido de recogida
      console.log("[Webhook] Creando orden de recogida (delivery_orders) con status 'requested'...");
      const { data: order, error: orderError } = await supabaseClient
        .from("delivery_orders")
        .insert([{
          user_id: storeId,
          customer_id: customerId,
          customer_name: customerPushName,
          customer_phone: customerPhone,
          customer_address: address,
          status: "requested",
          notes: "Creado automáticamente desde WhatsApp Webhook"
        }])
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      console.log(`[Webhook] Orden creada con éxito. ID de orden: ${order.id}, tracking_token: ${order.tracking_token}`);

      // 3. Responder con el enlace de seguimiento
      const trackingUrl = `https://sistema-ventas-topaz.vercel.app/tracking/${order.tracking_token}`;
      const replyText = `¡Gracias ${customerPushName}! 👋 Hemos recibido tu solicitud para recoger tu ropa en *${storeName}*.\n\n📍 *Dirección:* ${address}\n🚚 *Estatus:* Pendiente de asignación de repartidor.\n\nSigue el estatus en vivo de tu ropa en este enlace: ${trackingUrl}`;

      console.log(`[Webhook] Enviando confirmación con link de rastreo a ${customerPhone}...`);
      await sendWhatsAppText(EVOLUTION_API_URL, instanceName, sessionToken, customerPhone, replyText);

    } else {
      console.log(`[Webhook] Mensaje sin direccion clara. Enviando instrucciones flexibles a ${customerPhone}...`);
      const flexibleInstructionsText = `Hola ${customerPushName}! Bienvenido a *${storeName}*.\n\nPara solicitar que vayamos a recoger tu ropa a domicilio, puedes enviarnos tu ubicacion por WhatsApp o escribir tu direccion completa con calle, numero y colonia.\n\nEjemplo: *Calle 10 #123, Colonia Centro*`;
      await sendWhatsAppText(EVOLUTION_API_URL, instanceName, sessionToken, customerPhone, flexibleInstructionsText);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[Webhook Error] Error procesando mensaje de WhatsApp:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Función auxiliar para enviar textos vía Evolution API
async function sendWhatsAppText(baseUrl: string, instance: string, apikey: string | null, number: string, text: string) {
  try {
    const phoneCandidates = getPhoneCandidates(number);
    if (phoneCandidates.length === 0) {
      console.error("[Webhook WhatsApp] Telefono destino vacio.");
      return;
    }

    const phone = await resolveEvolutionPhone(baseUrl, instance, apikey, phoneCandidates);
    const url = `${baseUrl}/message/sendText/${instance}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apikey) {
      headers["apikey"] = apikey;
    }

    console.log(`[Evolution API] Enviando POST a: ${url}`);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: phone,
        text: text,
        delay: 1200 // Retardo simulado de escritura humana
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Webhook WhatsApp] Error al enviar mensaje: ${res.status} ${res.statusText} - ${errorText}`);
    } else {
      console.log(`[Webhook WhatsApp] Mensaje enviado exitosamente a ${phone}`);
    }
  } catch (e) {
    console.error("[Webhook WhatsApp] Error de red enviando mensaje:", e);
  }
}
