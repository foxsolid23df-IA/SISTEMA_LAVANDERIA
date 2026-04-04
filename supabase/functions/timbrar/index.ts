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

    // El Emisor será resuelto dinámicamente desde Supabase usando el terminal de la venta

    // ─── PASO 0: Parsear body del frontend ────────────────────────
    const body = await req.json();
    const { ticket_uuid, rfc, razon_social, codigo_postal, regimen_fiscal, uso_cfdi, email } = body;

    console.log("Body recibido para Facturama Multiemisor:", JSON.stringify(body));

    if (!ticket_uuid || !rfc || !razon_social || !codigo_postal || !regimen_fiscal || !uso_cfdi) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos para timbrar: ticket_uuid, rfc, razon_social, codigo_postal, regimen_fiscal, uso_cfdi" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PASO 1: Obtener datos reales de la venta y sus productos ────
    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('ticket_uuid', ticket_uuid)
      .single();

    // ─── PASO 1.1: OBTENER DATA DEL EMISOR ───
    let issuer = null;
    let portal = null;

    if (sale.billing_issuer_id) {
      // Si el cajero seleccionó en caja manualmente al emisor
      const { data: directIssuer } = await supabase.from('billing_issuers').select('*').eq('id', sale.billing_issuer_id).single();
      if (directIssuer) {
        issuer = directIssuer;
      }
      
      // Intentamos recuperar también un portal ligado a este usuario por si requerimos limites_tipo
      const { data: foundPortal } = await supabase.from('billing_portals').select('*').eq('billing_issuer_id', sale.billing_issuer_id).limit(1).maybeSingle();
      if (foundPortal) portal = foundPortal;
    } 

    if (!issuer) {
      // Comportamiento de AutoFactura Clásico: Resolviendo por terminal
      if (!sale.terminal_id) {
        return new Response(JSON.stringify({ success: false, message: "La venta no está asignada a ninguna terminal ni a un emisor específico." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: terminal } = await supabase.from('terminals').select('billing_portal_id').eq('id', sale.terminal_id).single();
      if (!terminal || !terminal.billing_portal_id) {
        return new Response(JSON.stringify({ success: false, message: "El comercio no tiene configurado un portal de facturación y no se seleccionó el emisor manualmente en caja." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: fetchedPortal } = await supabase.from('billing_portals').select('*, billing_issuers(*)').eq('id', terminal.billing_portal_id).single();
      if (!fetchedPortal || !fetchedPortal.billing_issuers) {
        return new Response(JSON.stringify({ success: false, message: "No hay un emisor fiscal vinculado a este portal." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      portal = fetchedPortal;
      issuer = portal.billing_issuers;
    }

    // ─── PASO 1.2: VALIDACIÓN DE LÍMITES DE TIEMPO (Si se encontró portal) ───
    const saleDate = new Date(sale.created_at);
    const now = new Date();
    if (portal) {
      if (portal.limite_tipo === 'mes_consumo') {
        if (saleDate.getMonth() !== now.getMonth() || saleDate.getFullYear() !== now.getFullYear()) {
           return new Response(JSON.stringify({ success: false, message: "Su ticket ha expirado, debe ser facturado en el mismo mes de su consumo." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else if (portal.limite_tipo === 'dias' && portal.limite_dias > 0) {
        const diffTime = Math.abs(now.getTime() - saleDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > portal.limite_dias) {
           return new Response(JSON.stringify({ success: false, message: `Su ticket ha expirado. El comercio permite facturar máximo ${portal.limite_dias} días después del consumo.` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // ─── PASO 1.5: LIMPIEZA DE FACTURAS PREVIAS ───
    await supabase.from('invoices').delete().eq('sale_id', sale.id);

    // Calcular factor de impuesto
    const hasTax = (sale.tax_amount || 0) > 0;
    const taxRate = hasTax ? (sale.tax_amount / (sale.subtotal || (sale.total - sale.tax_amount))) : 0;

    // ─── PASO 1.8: AGRUPACIÓN U ORDINARIO ───
    let facturamaItems = [];
    if (portal && portal.agrupar_conceptos) {
      // Lógica de Venta General
      let totalSubtotal = 0;
      let totalTax = 0;
      
      sale.sale_items.forEach((item: any) => {
        const unitPriceBeforeTax = hasTax ? (item.price / (1 + taxRate)) : item.price;
        const subtotalItem = unitPriceBeforeTax * item.quantity;
        const taxAmountItem = (item.total || (item.price * item.quantity)) - subtotalItem;
        totalSubtotal += subtotalItem;
        totalTax += taxAmountItem;
      });

      const genericItem: any = {
        ProductCode: portal.clave_servicio_agrupada || "01010101",
        Description: "Venta General",
        UnitCode: "E48",
        Quantity: 1,
        UnitPrice: parseFloat(totalSubtotal.toFixed(2)),
        Subtotal: parseFloat(totalSubtotal.toFixed(2)),
        TaxObject: hasTax ? "02" : "01",
        Total: parseFloat((totalSubtotal + totalTax).toFixed(2))
      };

      if (hasTax) {
        genericItem.Taxes = [{
            Total: parseFloat(totalTax.toFixed(2)),
            Name: "IVA",
            Base: parseFloat(totalSubtotal.toFixed(2)),
            Rate: parseFloat(taxRate.toFixed(2)),
            IsRetention: false
        }];
      }
      facturamaItems.push(genericItem);
    } else {
      // Lógica Desglosada actual
      facturamaItems = sale.sale_items.map((item: any) => {
        const unitPriceBeforeTax = hasTax ? (item.price / (1 + taxRate)) : item.price;
        const subtotalItem = unitPriceBeforeTax * item.quantity;
        const taxAmountItem = (item.total || (item.price * item.quantity)) - subtotalItem;

        const itemObj: any = {
          ProductCode: "01010101",
          Description: item.product_name || "Venta de Producto",
          UnitCode: "E48",
          Quantity: item.quantity,
          UnitPrice: parseFloat(unitPriceBeforeTax.toFixed(2)),
          Subtotal: parseFloat(subtotalItem.toFixed(2)),
          TaxObject: hasTax ? "02" : "01",
          Total: parseFloat((item.total || (item.price * item.quantity)).toFixed(2))
        };

        if (hasTax) {
          itemObj.Taxes = [{
            Total: parseFloat(taxAmountItem.toFixed(2)),
            Name: "IVA",
            Base: parseFloat(subtotalItem.toFixed(2)),
            Rate: parseFloat(taxRate.toFixed(2)),
            IsRetention: false
          }];
        }
        return itemObj;
      });
    }

    const facturamaBody = {
      CfdiType: "I",
      NameId: "1",
      LogoUrl: portal?.logo_url || null,
      PaymentForm: (sale.payment_method === 'tarjeta') ? "04" : "01", 
      PaymentMethod: "PUE",
      ExpeditionPlace: issuer.codigo_postal,
      Folio: ticket_uuid.substring(0, 8).toUpperCase(),
      Issuer: {
        Rfc: issuer.rfc,
        Name: issuer.razon_social,
        FiscalRegime: issuer.regimen_fiscal
      },
      Receiver: {
        Rfc: rfc,
        CfdiUse: uso_cfdi,
        Name: razon_social,
        FiscalRegime: regimen_fiscal,
        TaxZipCode: codigo_postal
      },
      Items: facturamaItems
    };

    console.log("Enviando Payload REAL a Facturama:", JSON.stringify(facturamaBody));

    // ─── PASO 2: POST a Facturama API-LITE ──────────────────────────
    const cfdiRes = await fetch(`${BASE_URL}/api-lite/3/cfdis`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${encodedCredentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(facturamaBody),
    });

    const textResponse = await cfdiRes.text();
    console.log("Facturama API-LITE Body:", textResponse);

    let cfdiData;
    try {
      cfdiData = textResponse ? JSON.parse(textResponse) : {};
    } catch {
      cfdiData = { rawText: textResponse };
    }

    if (!cfdiRes.ok) {
      let errorMsg = `Facturama Error ${cfdiRes.status}`;
      if (cfdiData.ModelState) {
        errorMsg += ": " + Object.values(cfdiData.ModelState).flat().join(", ");
      } else if (cfdiData.Message) {
        errorMsg += ": " + cfdiData.Message;
      }
      return new Response(JSON.stringify({ success: false, message: errorMsg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    // ─── PASO 3: OBTENER ARCHIVOS BASE64 (API LITE - issuedLite) ───
    const resourceId = cfdiData.Id || cfdiData.id || cfdiData.Uuid || cfdiData.uuid;

    if (cfdiRes.ok && resourceId) {
      try {
        console.log(`Pausa de 1.5s para archivos ID: ${resourceId}`);
        await new Promise(r => setTimeout(r, 1500));

        // PDF
        const pdfReq = await fetch(`${BASE_URL}/cfdi/pdf/issuedLite/${resourceId}`, {
          headers: { "Authorization": `Basic ${encodedCredentials}` }
        });
        if (pdfReq.ok) {
          const pdfData = await pdfReq.json();
          if (pdfData.Content) cfdiData.Pdf = pdfData.Content;
        }

        // XML
        const xmlReq = await fetch(`${BASE_URL}/cfdi/xml/issuedLite/${resourceId}`, {
          headers: { "Authorization": `Basic ${encodedCredentials}` }
        });
        if (xmlReq.ok) {
          const xmlData = await xmlReq.json();
          if (xmlData.Content) cfdiData.Xml = xmlData.Content;
        }

        // ─── PASO 4: PERSISTENCIA EN SUPABASE ────────────────────────
        const invoiceRecord = {
          sale_id: sale.id,
          user_id: sale.user_id,
          uuid_cfdi: cfdiData.Uuid || cfdiData.uuid || cfdiData.FolioFiscal || 'STAMPED',
          facturama_id: cfdiData.Id || cfdiData.id || null, // Guardamos el ID interno para el envío de correo
          emisor_rfc: issuer.rfc,
          cliente_rfc: rfc,
          xml_url: cfdiData.Xml || null, 
          pdf_url: cfdiData.Pdf || null, 
          total: sale.total,
          status: 'VIGENTE'
        };
        
        const { error: insertErr } = await supabase.from('invoices').insert([invoiceRecord]);
        if (insertErr) {
            console.error("Error al insertar registro de factura:", insertErr);
        }
        await supabase.from('sales').update({ facturado: true }).eq('id', sale.id);

      } catch (err) {
        console.error("Error persistencia:", err);
      }
    }

    return new Response(JSON.stringify({ success: true, data: cfdiData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Error inesperado en timbrar:", err);
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
