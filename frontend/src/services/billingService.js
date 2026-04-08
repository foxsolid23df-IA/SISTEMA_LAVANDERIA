import { supabase } from '../supabase';

export const billingService = {
  /**
   * Obtiene la lista de facturas
   */
  async getInvoices() {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Cancela una factura llamando a la Edge Function
   */
  async cancelInvoice(id, motive, uuidReplacement = null) {
    const { data: session } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke('cancelar-cfdi', {
      body: { 
        invoiceId: id,
        motive,
        uuidReplacement: motive === '01' ? uuidReplacement : null
      }
    });

    if (error) throw error;
    return data;
  }
};
