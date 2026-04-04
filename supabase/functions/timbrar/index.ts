import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createFacturamaInvoice, downloadCfdiFile } from "./facturama-service.ts";
import { getOrCreateClient } from "./client-management.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Credenciales Facturama (formato "usuario:contraseña")
    const FACTURAMA_API_KEY = Deno.env.get("FACTURAMA_API_KEY") || "NexumPos:NexumPos";

    const { 
      ticket_uuid, 
      pin,
      table, 
      client_data 
    } = await req.json();

    if (!ticket_uuid || !table || !client_data || !pin) {
      throw new Error("Faltan parámetros requeridos (ticket_uuid, pin, table, client_data)");
    }

    // 1. Obtener datos de la venta u orden con validación de PIN
    const { data: record, error: fetchError } = await supabase
      .from(table)
      .select(`*`)
      .eq(table === 'sales' ? 'ticket_uuid' : 'id', ticket_uuid)
      .eq(table === 'sales' ? 'pin_facturacion' : 'pin', pin)
      .single();

    if (fetchError || !record) {
      throw new Error(`No se encontró el registro en la tabla ${table}`);
    }

    // Verificar si ya fue facturado
    if (record.facturado) {
      throw new Error("Este registro ya tiene una factura generada o solicitada");
    }

    // 2. Obtener items (detalles)
    const itemsRelation = table === 'sales' ? 'sale_items' : 'order_items';
    const { data: items, error: itemsError } = await supabase
      .from(itemsRelation)
      .select('*')
      .eq(table === 'sales' ? 'sale_id' : 'order_id', record.id);

    if (itemsError || !items || items.length === 0) {
      throw new Error("No se encontraron items para este registro");
    }

    // 3. Obtener datos del emisor desde billing_issuers (tabla donde el frontend guarda RFC y CSD)
    const { data: issuer_data, error: issuerError } = await supabase
      .from('billing_issuers')
      .select('*')
      .eq('user_id', record.user_id)
      .eq('is_csd_loaded', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (issuerError || !issuer_data) {
      throw new Error("No se encontró un emisor con CSD cargado. Configura tus datos fiscales en Configuración → Datos de Emisión Fiscal.");
    }

    if (!issuer_data.rfc || !issuer_data.razon_social || !issuer_data.regimen_fiscal) {
      throw new Error("Los datos fiscales del emisor están incompletos (RFC, Razón Social o Régimen Fiscal faltante).");
    }

    // 4. Gestionar cliente en DB local (API Multiemisor no tiene catálogo de clientes)
    const client_record = await getOrCreateClient(supabase, client_data);

    // 5. Crear CFDI en Facturama API Multiemisor (/api-lite/3/cfdis)
    const facturamaResponse = await createFacturamaInvoice(
      issuer_data,
      client_record,
      record,
      items,
      FACTURAMA_API_KEY
    );

    // 6. Intentar descargar PDF y XML
    const cfdiId = facturamaResponse.Id;
    let pdfBase64 = "";
    let xmlBase64 = "";
    
    try {
      pdfBase64 = await downloadCfdiFile(cfdiId, "pdf", FACTURAMA_API_KEY);
    } catch (e) {
      console.warn("No se pudo descargar PDF:", e);
    }
    
    try {
      xmlBase64 = await downloadCfdiFile(cfdiId, "xml", FACTURAMA_API_KEY);
    } catch (e) {
      console.warn("No se pudo descargar XML:", e);
    }

    // 7. Extraer UUID fiscal del complemento de timbre
    const folioFiscal = facturamaResponse.Complement?.TaxStamp?.Uuid 
      || facturamaResponse.Uuid 
      || "";

    // 8. Persistir factura en la tabla 'invoices'
    const { error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        [table === 'sales' ? 'sale_id' : 'order_id']: record.id,
        client_id: client_record.id,
        facturama_id: cfdiId,
        folio: facturamaResponse.Folio,
        serie: facturamaResponse.Serie || null,
        uuid_fiscal: folioFiscal,
        xml_url: xmlBase64 || null,
        pdf_url: pdfBase64 || null,
        total: record.total,
        status: 'ACTIVO'
      });

    if (invoiceError) {
      console.warn("⚠️ CFDI creado en Facturama pero error al guardar en DB:", invoiceError);
    }

    // 9. Marcar como facturado en la tabla original
    const { error: updateError } = await supabase
      .from(table)
      .update({ facturado: true })
      .eq('id', record.id);

    if (updateError) {
      console.warn("⚠️ Error al actualizar estado de facturación:", updateError);
    }

    // 10. Respuesta exitosa
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Factura generada exitosamente",
      data: {
        Id: cfdiId,
        Uuid: folioFiscal,
        FolioFiscal: folioFiscal,
        Folio: facturamaResponse.Folio,
        Pdf: pdfBase64 || null,
        Xml: xmlBase64 || null
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("❌ Error en Timbrar:", err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
