import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ConnectionTestResult = {
  success: boolean;
  connected: boolean;
  number: string | null;
  instanceName: string;
  gateway: string;
  error: string | null;
  details: Record<string, unknown> | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { gateway_type, session_token, instance_name } = body;

    if (!gateway_type) {
      return new Response(
        JSON.stringify({ error: "Falta el campo gateway_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CASO 1: WhatsApp Centralizado (Twilio) ──
    if (gateway_type === "central_saas") {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
      const twilioWhatsapp = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "";

      if (!twilioSid || !twilioToken || !twilioWhatsapp) {
        const result: ConnectionTestResult = {
          success: false,
          connected: false,
          number: null,
          instanceName: "twilio_central",
          gateway: "central_saas",
          error: "Credenciales de Twilio no configuradas en el servidor.",
          details: null,
        };
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar Twilio haciendo una petición ligera (listar mensajes con filtro vacío)
      try {
        const auth = btoa(`${twilioSid}:${twilioToken}`);
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json?PageSize=1`,
          {
            method: "GET",
            headers: { Authorization: `Basic ${auth}` },
          }
        );

        const result: ConnectionTestResult = {
          success: res.ok,
          connected: res.ok,
          number: twilioWhatsapp,
          instanceName: "twilio_central",
          gateway: "central_saas",
          error: res.ok ? null : `Twilio respondió con status ${res.status}`,
          details: null,
        };
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        const result: ConnectionTestResult = {
          success: false,
          connected: false,
          number: twilioWhatsapp,
          instanceName: "twilio_central",
          gateway: "central_saas",
          error: `Error de red con Twilio: ${err.message}`,
          details: null,
        };
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── CASO 2: Evolution API (QR Linked) ──
    if (gateway_type === "qr_linked") {
      const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
      const defaultInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "default";
      const instance = instance_name || defaultInstance;
      const apikey = session_token || "";

      if (!evolutionApiUrl) {
        const result: ConnectionTestResult = {
          success: false,
          connected: false,
          number: null,
          instanceName: instance,
          gateway: "qr_linked",
          error: "EVOLUTION_API_URL no está configurada en el servidor.",
          details: null,
        };
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!apikey) {
        const result: ConnectionTestResult = {
          success: false,
          connected: false,
          number: null,
          instanceName: instance,
          gateway: "qr_linked",
          error: "Falta la API Key (whatsapp_session_token) de Evolution API.",
          details: null,
        };
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Intentar obtener estado de la instancia
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          apikey,
        };

        let isConnected = false;
        let number: string | null = null;
        let details: Record<string, unknown> = {};
        let rawResponse: unknown = null;

        // 1. Obtener lista de instancias y buscar la nuestra
        try {
          const infoRes = await fetch(`${evolutionApiUrl}/instance/fetchInstances`, {
            method: "GET",
            headers,
          });
          
          rawResponse = await infoRes.json();
          console.log("[test-whatsapp] fetchInstances raw:", JSON.stringify(rawResponse));

          // Evolution API v2.x returns array directly or wrapped in { instances: [...] }
          let instancesList: any[] = [];
          if (Array.isArray(rawResponse)) {
            instancesList = rawResponse;
          } else if (rawResponse && typeof rawResponse === "object") {
            // Try common wrapper keys
            instancesList = (rawResponse as any).instances || 
                           (rawResponse as any).data || 
                           [rawResponse];
          }

          const thisInstance = instancesList.find((i: any) => 
            i.name === instance || i.instanceName === instance
          );
          
          console.log("[test-whatsapp] found instance:", JSON.stringify(thisInstance));

          if (thisInstance) {
            // Evolution API v2.x uses "connectionStatus": "open" | "close" | "connecting"
            const connStatus = String(thisInstance.connectionStatus || thisInstance.state || thisInstance.status || "").toLowerCase();
            isConnected = connStatus === "open" || thisInstance.connected === true;
            
            // Phone number can be in different places
            number = thisInstance.number || 
                    thisInstance.instance?.number || 
                    thisInstance.remoteJid || null;
            
            details = {
              name: thisInstance.name || thisInstance.instanceName,
              number: number,
              connectionStatus: connStatus,
              integration: thisInstance.integration,
            };
          } else {
            details = { error: "Instance not found in list", instanceName: instance, listCount: instancesList.length };
          }
        } catch (e: any) {
          console.log("[test-whatsapp] fetchInstances error:", e.message);
          details = { fetchError: e.message };
        }

        const result: ConnectionTestResult = {
          success: true,
          connected: isConnected,
          number: number,
          instanceName: instance,
          gateway: "qr_linked",
          error: isConnected ? null : "La instancia no está conectada. Escanea el QR desde el panel de Evolution API.",
          details,
        };
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        console.log("[test-whatsapp] critical error:", err.message);
        const result: ConnectionTestResult = {
          success: false,
          connected: false,
          number: null,
          instanceName: instance,
          gateway: "qr_linked",
          error: `Error de red con Evolution API: ${err.message}`,
          details: null,
        };
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── CASO 3: SMS Only ──
    if (gateway_type === "sms_only") {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
      const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

      if (!twilioSid || !twilioToken || !twilioPhone) {
        const result: ConnectionTestResult = {
          success: false,
          connected: false,
          number: null,
          instanceName: "twilio_sms",
          gateway: "sms_only",
          error: "Credenciales de Twilio SMS no configuradas en el servidor.",
          details: null,
        };
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const auth = btoa(`${twilioSid}:${twilioToken}`);
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json?PageSize=1`,
          {
            method: "GET",
            headers: { Authorization: `Basic ${auth}` },
          }
        );

        const result: ConnectionTestResult = {
          success: res.ok,
          connected: res.ok,
          number: twilioPhone,
          instanceName: "twilio_sms",
          gateway: "sms_only",
          error: res.ok ? null : `Twilio SMS respondió con status ${res.status}`,
          details: null,
        };
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        const result: ConnectionTestResult = {
          success: false,
          connected: false,
          number: twilioPhone,
          instanceName: "twilio_sms",
          gateway: "sms_only",
          error: `Error de red con Twilio SMS: ${err.message}`,
          details: null,
        };
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Gateway no reconocido
    return new Response(
      JSON.stringify({ error: `Tipo de gateway no reconocido: ${gateway_type}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[test-whatsapp-connection] Error critico:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
