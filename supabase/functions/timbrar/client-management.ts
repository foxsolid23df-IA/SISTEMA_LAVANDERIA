import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getOrCreateClient(
  supabase: SupabaseClient,
  client_data: any,
  apiKey: string
): Promise<any> {
    
  // Intentar buscar por RFC en nuestra DB
  const { data: existingClient, error: fetchErr } = await supabase
    .from('clients')
    .select('*')
    .eq('rfc', client_data.rfc)
    .single();

  if (existingClient) {
    // Si ya tiene facturama_id, retornar
    if (existingClient.facturama_id) {
      return existingClient;
    }
    // Si no tiene, intentar crearlo en Facturama
    const facturamaId = await syncClientWithFacturama(existingClient, apiKey);
    const { data: updatedClient } = await supabase
      .from('clients')
      .update({ facturama_id: facturamaId })
      .eq('id', existingClient.id)
      .select()
      .single();
    return updatedClient;
  }

  // Si no existe, crear en Facturama primero
  const facturamaId = await syncClientWithFacturama(client_data, apiKey);
  
  // Insertar en nuestra DB
  const { data: newClient, error: insertErr } = await supabase
    .from('clients')
    .insert({
      ...client_data,
      facturama_id: facturamaId
    })
    .select()
    .single();

  if (insertErr) throw insertErr;
  return newClient;
}

async function syncClientWithFacturama(clientData: any, apiKey: string): Promise<string> {
  const apiUrl = "https://apisandbox.facturama.mx/2/client";
  
  const receiver = {
    Rfc: clientData.rfc,
    Name: clientData.razon_social,
    FiscalRegime: clientData.regimen_fiscal,
    TaxZipCode: clientData.codigo_postal,
    Email: clientData.email,
    CfdiUse: "G03"
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${btoa(apiKey)}`,
    },
    body: JSON.stringify(receiver),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.warn("Error al registrar cliente en Facturama (pestaña ya existe?):", errorData);
    // Si ya existe, podríamos intentar un GET para obtener su ID, 
    // pero por ahora lanzamos error o intentamos retornar un id ficticio si es error de RFC duplicado
    if (errorData.Message && errorData.Message.includes("ya existe")) {
       // Buscar por RFC directamente en Facturama es lo ideal aquí
       // Pero por simplicidad en Sandbox, retornaremos un ID de error o buscaremos
    }
    throw new Error(errorData.Message || "Error al registrar cliente en Facturama");
  }

  const data = await response.json();
  return data.Id;
}
