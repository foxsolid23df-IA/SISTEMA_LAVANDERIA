import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Gestiona clientes SÓLO en la base de datos local (Supabase).
 * La API Web/Lite (/2/) de Facturama NO tiene endpoint de clientes — 
 * el receptor se pasa inline en cada CFDI.
 * Solo almacenamos localmente para historial y autocompletado.
 */
export async function getOrCreateClient(
  supabase: SupabaseClient,
  client_data: any
): Promise<any> {
    
  // Intentar buscar por RFC en nuestra DB
  const { data: existingClient, error: fetchErr } = await supabase
    .from('clients')
    .select('*')
    .eq('rfc', client_data.rfc)
    .single();

  if (existingClient) {
    // Actualizar datos fiscales por si cambiaron
    const { data: updatedClient } = await supabase
      .from('clients')
      .update({
        razon_social: client_data.razon_social,
        regimen_fiscal: client_data.regimen_fiscal,
        uso_cfdi: client_data.uso_cfdi,
        codigo_postal: client_data.codigo_postal,
        email: client_data.email
      })
      .eq('id', existingClient.id)
      .select()
      .single();

    return updatedClient || existingClient;
  }

  // Si no existe, insertar en nuestra DB
  const { data: newClient, error: insertErr } = await supabase
    .from('clients')
    .insert({
      ...client_data
    })
    .select()
    .single();

  if (insertErr) throw insertErr;
  return newClient;
}
