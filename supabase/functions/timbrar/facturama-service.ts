/**
 * Facturama API Multiemisor - Servicio de timbrado CFDI 4.0
 * 
 * Endpoint: POST /api-lite/3/cfdis
 * Docs: https://apisandbox.facturama.mx
 * 
 * Diferencias vs API Web (/2/):
 * - Se incluye nodo Issuer obligatorio (emisor con CSD cargados)
 * - El Folio es obligatorio y manual
 * - No hay catálogo de clientes — Receiver va inline
 * - Los CFDIs NO son visibles en la plataforma web de Facturama
 */

const FACTURAMA_BASE_URL = Deno.env.get("FACTURAMA_BASE_URL") 
  || "https://apisandbox.facturama.mx";

/**
 * Crea un CFDI 4.0 usando la API Multiemisor de Facturama
 */
export async function createFacturamaInvoice(
  issuer: any,
  client: any,
  record: any,
  items: any[],
  apiKey: string
): Promise<any> {
  // Determinar si la orden incluye impuestos
  const hasTax = record.has_tax === true || record.invoice_requested === true;
  const apiUrl = `${FACTURAMA_BASE_URL}/api-lite/3/cfdis`;

  // Construir items con estructura Multiemisor
  const facturamaItems = items.map((item: any) => {
    const rawTotal = Number(item.total);
    const quantity = Number(item.quantity) || 1;

    // Si la orden tiene impuestos, el total ya incluye IVA 16%
    // Si NO tiene impuestos, el total es neto (sin IVA) y necesitamos agregarlo
    let subtotal: number;
    let taxAmount: number;
    let itemTotal: number;

    if (hasTax) {
      // Total ya incluye IVA → descomponer
      subtotal = rawTotal / 1.16;
      taxAmount = rawTotal - subtotal;
      itemTotal = rawTotal;
    } else {
      // Total es neto → agregarle IVA para el CFDI
      subtotal = rawTotal;
      taxAmount = rawTotal * 0.16;
      itemTotal = rawTotal + taxAmount;
    }

    const unitPrice = subtotal / quantity;

    return {
      ProductCode: "76111501",  // Servicio de lavandería
      Description: item.product_name || item.description || "Servicio de lavandería",
      UnitCode: "E48",  // Unidad de servicio
      Quantity: quantity,
      UnitPrice: Number(unitPrice.toFixed(2)),
      Subtotal: Number(subtotal.toFixed(2)),
      TaxObject: "02",  // Sí objeto de impuesto
      Taxes: [
        {
          Total: Number(taxAmount.toFixed(2)),
          Name: "IVA",
          Base: Number(subtotal.toFixed(2)),
          Rate: 0.16,
          IsRetention: false,
          Type: "IVA",  // ← OBLIGATORIO en API Multiemisor
        },
      ],
      Total: Number(itemTotal.toFixed(2)),
    };
  });

  // Generar folio alfanumérico corto basado en el ID del registro
  const folio = String(record.folio || record.id).substring(0, 40);

  // Estructura CFDI 4.0 para API Multiemisor
  const cfdiRequest = {
    CfdiType: "I",                // Ingreso
    PaymentForm: record.payment_method === "cash" ? "01" : "03",
    PaymentMethod: "PUE",         // Pago en Una sola Exhibición
    Currency: "MXN",              // ← OBLIGATORIO
    ExpeditionPlace: issuer.codigo_postal || "01000",
    Folio: folio,                 // Obligatorio en Multiemisor

    // Nodo Issuer — Principal característica de API Multiemisor
    // El RFC del emisor debe tener CSD cargados via /api-lite/csds
    Issuer: {
      FiscalRegime: issuer.regimen_fiscal,
      Rfc: issuer.rfc,
      Name: issuer.razon_social,
    },

    // Receptor — datos inline (no se usa catálogo de clientes)
    Receiver: {
      Rfc: client.rfc,
      Name: client.razon_social,
      CfdiUse: client.uso_cfdi || "G03",
      FiscalRegime: client.regimen_fiscal,
      TaxZipCode: client.codigo_postal,
    },

    Items: facturamaItems,
  };

  console.log("➡️ Enviando CFDI a Facturama Multiemisor:", JSON.stringify(cfdiRequest, null, 2));

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${btoa(apiKey)}`,
    },
    body: JSON.stringify(cfdiRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { Message: errorText };
    }
    console.error("❌ Error de Facturama Multiemisor:", response.status, errorData);
    throw new Error(
      errorData.Message || 
      errorData.message || 
      `Error ${response.status} al crear CFDI en Facturama`
    );
  }

  const result = await response.json();
  console.log("✅ CFDI creado exitosamente:", result.Id);
  return result;
}

/**
 * Descarga el PDF de un CFDI creado con API Multiemisor
 * Retorna el contenido en Base64
 */
export async function downloadCfdiFile(
  cfdiId: string,
  format: "pdf" | "xml",
  apiKey: string
): Promise<string> {
  const url = `${FACTURAMA_BASE_URL}/cfdi/${format}/issuedLite/${cfdiId}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${btoa(apiKey)}`,
    },
  });

  if (!response.ok) {
    console.error(`❌ Error descargando ${format}:`, response.status);
    return "";
  }

  const data = await response.json();
  return data.Content || "";
}

/**
 * Cancela un CFDI creado con API Multiemisor
 * Motivos: 01, 02, 03, 04
 */
export async function cancelCfdi(
  cfdiId: string,
  motive: string,
  apiKey: string,
  uuidReplacement?: string
): Promise<any> {
  let url = `${FACTURAMA_BASE_URL}/api-lite/cfdis/${cfdiId}?motive=${motive}`;
  if (uuidReplacement) {
    url += `&uuidReplacement=${uuidReplacement}`;
  }

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Authorization": `Basic ${btoa(apiKey)}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.Message || `Error al cancelar CFDI: ${response.status}`);
  }

  return await response.json();
}
