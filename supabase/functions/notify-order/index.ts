import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_ORDER_VERSION = "delivery-quote-v3-20260528";

type DispatchConfig = {
  whatsappGatewayType: string;
  whatsappSessionToken?: string | null;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  twilioWhatsappNumber: string;
  evolutionApiUrl: string;
  evolutionInstanceName: string;
};

type DispatchResult = {
  success: boolean;
  gateway: string;
  error: string | null;
  sentTo?: string;
};

const getPhoneCandidates = (phone: string) => {
  const digits = String(phone || "").replace(/\D/g, "");
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
};

const looksWhatsappNumberAvailable = (entry: any) =>
  entry?.exists === true ||
  entry?.numberExists === true ||
  entry?.isWhatsapp === true ||
  entry?.jid ||
  entry?.status === "exists";

const resolveEvolutionPhone = async (
  candidates: string[],
  config: DispatchConfig,
) => {
  if (candidates.length <= 1) return candidates[0] || "";

  try {
    const res = await fetch(`${config.evolutionApiUrl}/chat/whatsappNumbers/${config.evolutionInstanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.whatsappSessionToken || "",
      },
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
};

const sendMessage = async (
  rawPhone: string,
  message: string,
  config: DispatchConfig,
): Promise<DispatchResult> => {
  const phoneCandidates = getPhoneCandidates(rawPhone);
  if (phoneCandidates.length === 0) {
    return { success: false, gateway: "none", error: "Telefono destino vacio." };
  }

  let phone = phoneCandidates[0];

  let gatewayUsed = "";
  let errorLog = "";

  if (config.whatsappGatewayType === "qr_linked" && config.whatsappSessionToken) {
    gatewayUsed = "whatsapp_qr_linked";
    try {
      phone = await resolveEvolutionPhone(phoneCandidates, config);
      const res = await fetch(`${config.evolutionApiUrl}/message/sendText/${config.evolutionInstanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": config.whatsappSessionToken,
        },
        body: JSON.stringify({
          number: phone,
          text: message,
          delay: 5000,
        }),
      });

      if (res.ok) {
        return { success: true, gateway: gatewayUsed, error: null, sentTo: phone };
      }

      const errorText = await res.text();
      errorLog = `Error Gateway QR: ${res.status} ${res.statusText} ${errorText}`;
    } catch (err: any) {
      errorLog = `Falla de red en Gateway QR: ${err.message}`;
    }
  }

  if (
    config.whatsappGatewayType === "central_saas" &&
    config.twilioAccountSid &&
    config.twilioAuthToken &&
    config.twilioWhatsappNumber
  ) {
    gatewayUsed = "whatsapp_central_saas";
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`;
      const auth = btoa(`${config.twilioAccountSid}:${config.twilioAuthToken}`);
      const params = new URLSearchParams();
      params.append("To", `whatsapp:+${phone}`);
      params.append("From", config.twilioWhatsappNumber);
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
        return { success: true, gateway: gatewayUsed, error: null, sentTo: phone };
      }

      const resData = await res.json();
      errorLog = `Error Twilio WhatsApp: ${resData.message || res.statusText}`;
    } catch (err: any) {
      errorLog = `Falla en Twilio WhatsApp: ${err.message}`;
    }
  }

  if (
    config.whatsappGatewayType === "sms_only" ||
    errorLog !== ""
  ) {
    gatewayUsed = "sms_fallback";

    if (config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber) {
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`;
        const auth = btoa(`${config.twilioAccountSid}:${config.twilioAuthToken}`);
        const params = new URLSearchParams();
        params.append("To", `+${phone}`);
        params.append("From", config.twilioPhoneNumber);
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
          return { success: true, gateway: gatewayUsed, error: null, sentTo: phone };
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

  return {
    success: false,
    gateway: gatewayUsed || "none",
    error: errorLog || "No se pudo despachar por ninguna pasarela",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      order_id,
      customer_name,
      customer_phone,
      customer_address,
      notes,
      driver_name,
      driver_phone,
      status,
      tracking_token,
      service_cost,
      delivery_fee,
      quote_notes,
      payment_amount,
      payment_method,
      payment_reference,
      whatsapp_gateway_type = "central_saas",
      whatsapp_session_token,
      store_name = "FoxSolid Laundry",
    } = body;

    console.log(`[notify-order ${NOTIFY_ORDER_VERSION}] Recibida peticion de notificacion de pedido:`, JSON.stringify(body));

    if (!customer_phone || !status || !tracking_token) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: customer_phone, status, tracking_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://sistema-ventas-topaz.vercel.app";
    const trackingUrl = `${appBaseUrl}/tracking/${tracking_token}`;
    const driverPortalUrl = `${appBaseUrl}/chofer`;
    const mapsUrl = customer_address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer_address)}`
      : "";
    const totalCost = (Number(service_cost) || 0) + (Number(delivery_fee) || 0);

    let customerMessage = "";
    switch (status) {
      case "quoted":
        customerMessage = `Hola ${customer_name}! *${store_name}* ya reviso tu solicitud.\n\nTarifa de recogida / delivery: $${Number(delivery_fee || 0).toFixed(2)} MXN.${quote_notes ? `\nNota: ${quote_notes}` : ""}\n\nEl costo del lavado se calcula despues en sucursal segun tus prendas. Revisa el detalle y confirma como prefieres pagar aqui: ${trackingUrl}`;
        break;
      case "accepted":
      case "assigned":
        customerMessage = `Hola ${customer_name}! Tu solicitud de recogida de ropa en *${store_name}* ha sido aceptada. Nuestro repartidor *${driver_name || "Asignado"}* va en camino a tu domicilio. Sigue el estatus en vivo aqui: ${trackingUrl}`;
        break;
      case "picked_up":
        customerMessage = `*${store_name}*: Recogimos tus prendas con exito. Ya estan en ruta hacia la sucursal. Consulta el desglose y costos aqui: ${trackingUrl}`;
        break;
      case "delivered_to_store":
        customerMessage = `*${store_name}*: Tus prendas ya estan en lavanderia para su lavado. El costo estimado es de $${totalCost.toFixed(2)} (Envio: $${Number(delivery_fee).toFixed(2)}). Revisa el ticket digital aqui: ${trackingUrl}`;
        break;
      case "completed":
        customerMessage = `*${store_name}*: Tu pedido de lavanderia ha sido completado y entregado. Gracias por tu preferencia. Detalle: ${trackingUrl}`;
        break;
      case "payment_received":
        customerMessage = `*${store_name}*: Recibimos un pago/abono para tu pedido.\n\nMonto: $${Number(payment_amount || 0).toFixed(2)} MXN\nMetodo: ${payment_method || "No especificado"}${payment_reference ? `\nReferencia: ${payment_reference}` : ""}\n\nEste comprobante queda registrado. Consulta tu saldo y estatus aqui: ${trackingUrl}`;
        break;
      case "cancelled":
        customerMessage = `*${store_name}*: Tu solicitud de recogida ha sido cancelada. Si tienes alguna duda, por favor contactanos.`;
        break;
      default:
        customerMessage = `*${store_name}*: Tu pedido ha cambiado al estado: *${status}*. Sigue el avance aqui: ${trackingUrl}`;
    }

    const config: DispatchConfig = {
      whatsappGatewayType: whatsapp_gateway_type,
      whatsappSessionToken: whatsapp_session_token,
      twilioAccountSid: Deno.env.get("TWILIO_ACCOUNT_SID") || "",
      twilioAuthToken: Deno.env.get("TWILIO_AUTH_TOKEN") || "",
      twilioPhoneNumber: Deno.env.get("TWILIO_PHONE_NUMBER") || "",
      twilioWhatsappNumber: Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "",
      evolutionApiUrl: Deno.env.get("EVOLUTION_API_URL") || "https://api.evolution.laundry.com",
      evolutionInstanceName: Deno.env.get("EVOLUTION_INSTANCE_NAME") || Deno.env.get("WHATSAPP_INSTANCE_NAME") || "default",
    };

    const customerResult = await sendMessage(customer_phone, customerMessage, config);
    let driverResult: DispatchResult | null = null;

    if (status === "assigned" && driver_phone) {
      const driverMessage = [
        `Nueva ruta asignada en *${store_name}*.`,
        `Orden: #${order_id || "N/A"}`,
        `Cliente: ${customer_name}`,
        `Telefono: ${customer_phone}`,
        `Direccion: ${customer_address || "Sin direccion"}`,
        notes ? `Notas: ${notes}` : null,
        mapsUrl ? `Mapa: ${mapsUrl}` : null,
        `Portal: ${driverPortalUrl}`,
      ].filter(Boolean).join("\n");

      driverResult = await sendMessage(driver_phone, driverMessage, config);
    }

    return new Response(
      JSON.stringify({
        version: NOTIFY_ORDER_VERSION,
        success: customerResult.success,
        gateway: customerResult.gateway,
        error: customerResult.error,
        customer: customerResult,
        driver: driverResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Error critico e inesperado en notify-order:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
