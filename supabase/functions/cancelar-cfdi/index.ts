import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── CONFIGURACIÓN FACTURAMA ─────────────────────────────────────
    const BASE_URL = "https://apisandbox.facturama.mx";
    
    // Credenciales de la API Facturama Sandbox
    const FACTURAMA_USER = Deno.env.get("FACTURAMA_USER") || "NexumPos";
    const FACTURAMA_PASSWORD = Deno.env.get("FACTURAMA_PASSWORD") || "NexumPos";
    
    // Authorization: Basic base64(usuario:contraseña)
    const encodedCredentials = btoa(`${FACTURAMA_USER}:${FACTURAMA_PASSWORD}`);

    // ─── PASO 0: Parsear body del frontend ────────────────────────
    const body = await req.json();
    const { id, motive = "02", uuidReplacement = "" } = body;

    console.log("Body recibido para cancelación:", JSON.stringify(body));

    if (!id) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos para cancelar: id (de la factura en Supabase)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PASO 1: Obtener datos de la factura en Supabase ────
    const { data: invoice, error: invoiceErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (invoiceErr || !invoice) {
        return new Response(
            JSON.stringify({ error: "No se encontró la factura en la base de datos." }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const facturamaId = invoice.facturama_id;
    if (!facturamaId) {
        return new Response(
            JSON.stringify({ error: "La factura no tiene un ID de Facturama asociado." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // ─── PASO 2: DELETE a Facturama API-LITE ──────────────────────────
    // El endpoint es: DELETE /api-lite/cfdis/{id}?motive={motive}&uuidReplacement={uuidReplacement}
    let cancelUrl = `${BASE_URL}/api-lite/cfdis/${facturamaId}?motive=${motive}`;
    if (motive === "01" && uuidReplacement) {
        cancelUrl += `&uuidReplacement=${uuidReplacement}`;
    }

    console.log(`Llamando a cancelación en Facturama: ${cancelUrl}`);

    const cancelRes = await fetch(cancelUrl, {
      method: "DELETE",
      headers: {
        "Authorization": `Basic ${encodedCredentials}`,
        "Content-Type": "application/json",
      }
    });

    const textResponse = await cancelRes.text();
    console.log("Facturama API-LITE Cancelación Response:", textResponse);

    let cancelData;
    try {
        cancelData = textResponse ? JSON.parse(textResponse) : {};
    } catch {
        cancelData = { rawText: textResponse };
    }

    if (!cancelRes.ok) {
      let errorMsg = `Facturama Error ${cancelRes.status}`;
      if (cancelData.ModelState) {
        errorMsg += ": " + Object.values(cancelData.ModelState).flat().join(", ");
      } else if (cancelData.Message) {
        errorMsg += ": " + cancelData.Message;
      }
      return new Response(JSON.stringify({ success: false, message: errorMsg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    // ─── PASO 3: ACTUALIZAR STATUS EN SUPABASE ────────────────────────
    const { error: updateErr } = await supabase
        .from('invoices')
        .update({ status: 'CANCELADO' })
        .eq('id', invoice.id);
    
    if (updateErr) {
        console.error("Error al actualizar status de factura a CANCELADO:", updateErr);
    }

    // Opcional: Marcar la venta como no facturada para poder volver a facturar (si el SAT permitiera)
    // El usuario decidirá si desea volver a facturar después de corregir datos.
    if (invoice.sale_id) {
        await supabase.from('sales').update({ facturado: false }).eq('id', invoice.sale_id);
    }

    return new Response(JSON.stringify({ success: true, data: cancelData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Error inesperado en cancelar-cfdi:", err);
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
