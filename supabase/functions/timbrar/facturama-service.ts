export async function createFacturamaInvoice(
  issuer: any,
  client: any,
  record: any,
  items: any[],
  apiKey: string
): Promise<any> {
  const apiUrl = "https://apisandbox.facturama.mx/2/cfdi"; // TODO: Usar producción en prod

  const facturamaItems = items.map((item: any) => {
    const total = Number(item.total);
    const quantity = Number(item.quantity) || 1;
    const subtotal = total / 1.16;
    const unitPrice = subtotal / quantity;
    const taxAmount = total - subtotal;

    return {
      ProductCode: "76111501", 
      Description: item.product_name || "Servicio",
      UnitCode: "E48", 
      Quantity: quantity,
      UnitPrice: Number(unitPrice.toFixed(2)),
      Subtotal: Number(subtotal.toFixed(2)),
      TaxObject: "02", 
      Taxes: [
        {
          Total: Number(taxAmount.toFixed(2)),
          Name: "IVA",
          Base: Number(subtotal.toFixed(2)),
          Rate: 0.16,
          IsRetention: false,
          Type: "Traslado"
        },
      ],
      Total: Number(total.toFixed(2)),
    };
  });

  const invoiceReq = {
    Type: "Invoice",
    CfdiType: "Ingreso",
    ExpeditionPlace: issuer.codigo_postal || "01000",
    PaymentForm: record.payment_method === "cash" ? "01" : "03", 
    PaymentMethod: "PUE",
    Currency: "MXN",
    Issuer: {
      Rfc: issuer.rfc,
      Name: issuer.razon_social,
      FiscalRegime: issuer.regimen_fiscal,
    },
    Receiver: {
      Id: client.facturama_id,
      Rfc: client.rfc,
      Name: client.razon_social,
      FiscalRegime: client.regimen_fiscal,
      CfdiUse: "G03",
      TaxZipCode: client.codigo_postal,
    },
    Items: facturamaItems,
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${btoa(apiKey)}`,
    },
    body: JSON.stringify(invoiceReq),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Error de Facturama:", errorData);
    throw new Error(errorData.Message || "Error al crear la factura en Facturama");
  }

  return await response.json();
}
