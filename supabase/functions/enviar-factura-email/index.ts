import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { cfdi_id, email, subject, comments, issuer_email } = body;

    console.log("Recibida petición de envío de correo:", JSON.stringify(body));

    if (!cfdi_id || !email) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: cfdi_id, email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CONFIGURACIÓN FACTURAMA ─────────────────────────────────────
    const BASE_URL = "https://apisandbox.facturama.mx"; // O "api.facturama.mx" para producción
    
    // Credenciales de la API Facturama Sandbox
    const FACTURAMA_USER = Deno.env.get("FACTURAMA_USER") || "NexumPos";
    const FACTURAMA_PASSWORD = Deno.env.get("FACTURAMA_PASSWORD") || "NexumPos";
    const encodedCredentials = btoa(`${FACTURAMA_USER}:${FACTURAMA_PASSWORD}`);

    // endpoint: POST /Cfdi?CfdiType=issuedLite&CfdiId={CfdiId}&Email={Email}&Subject={Subject}&Comments={Comments}&IssuerEmail={IssuerEmail}
    const params = new URLSearchParams({
        CfdiType: "issuedLite",
        CfdiId: cfdi_id,
        Email: email,
        Subject: subject || "",
        Comments: comments || "",
        IssuerEmail: issuer_email || ""
    });

    const url = `${BASE_URL}/Cfdi?${params.toString()}`;
    console.log("Enviando petición a Facturama:", url);

    const facturamaRes = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${encodedCredentials}`,
        "Content-Type": "application/json",
      }
    });

    const responseData = await facturamaRes.json();
    console.log("Respuesta de Facturama:", responseData);

    if (!facturamaRes.ok) {
       return new Response(JSON.stringify({ success: false, message: responseData.Message || "Error al enviar el correo" }), {
         status: 200, // Respondemos 200 pero con success: false para que el frontend lo maneje
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
    }

    return new Response(JSON.stringify({ success: responseData.success, message: responseData.msj }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Error inesperado en enviar-factura-email:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
