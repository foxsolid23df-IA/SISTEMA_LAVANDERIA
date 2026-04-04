import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createFacturamaInvoice } from "./facturama-service.ts";
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

    // Facturama API Key (Sandbox for now)
    // Se recomienda guardar estas credenciales en variables de entorno (Vault)
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

    // Verificar si ya fue facturado según la tabla
    const isAlreadyInvoiced = record.facturado;
    if (isAlreadyInvoiced) {
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

    // 3. Obtener datos del emisor (negocio)
    const { data: issuer_data, error: issuerError } = await supabase
      .from('business_settings')
      .select('*')
      .eq('user_id', record.user_id)
      .single();

    if (issuerError || !issuer_data) {
      throw new Error("No se encontraron los datos fiscales del emisor (business_settings)");
    }

    // 4. Gestionar cliente en Facturama y DB local
    const client_record = await getOrCreateClient(supabase, client_data, FACTURAMA_API_KEY);

    // 5. Crear factura en Facturama
    const facturamaResponse = await createFacturamaInvoice(
      issuer_data,
      client_record,
      record,
      items,
      FACTURAMA_API_KEY
    );

    // 6. Persistir factura en la tabla 'invoices' de Supabase
    const { error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        [table === 'sales' ? 'sale_id' : 'order_id']: record.id,
        client_id: client_record.id,
        facturama_id: facturamaResponse.Id,
        folio: facturamaResponse.Folio,
        serie: facturamaResponse.Serie,
        uuid_fiscal: facturamaResponse.Uuid,
        total: record.total,
        status: 'ACTIVO'
      });

    if (invoiceError) {
      console.warn("Factura creada en Facturama pero error al guardar en DB:", invoiceError);
    }

    // 7. Marcar como facturado en la tabla original
    const { error: updateError } = await supabase
      .from(table)
      .update({ facturado: true })
      .eq('id', record.id);

    if (updateError) {
      console.warn("Error al actualizar estado de facturación en la tabla origen:", updateError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Factura generada exitosamente",
      facturama_id: facturamaResponse.Id,
      folio: facturamaResponse.Folio,
      uuid: facturamaResponse.Uuid
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Error en Timbrar:", err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
