import { supabase } from '../supabase';

export const paymentMethodsService = {
  /**
   * Obtiene todos los métodos de pago.
   * Por defecto, ordena primero los del sistema, luego por nombre.
   */
  async getPaymentMethods(activeOnly = false) {
    let query = supabase
      .from('payment_methods')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Agrega un nuevo método de pago.
   */
  async addPaymentMethod(paymentData) {
    const { data, error } = await supabase
      .from('payment_methods')
      .insert([{
        name: paymentData.name,
        sat_key: paymentData.sat_key || null,
        is_system: false,
        is_active: true
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Actualiza un método de pago.
   */
  async updatePaymentMethod(id, updates) {
    const { data, error } = await supabase
      .from('payment_methods')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Activa o desactiva un método de pago.
   */
  async toggleStatus(id, isActive) {
    const { data, error } = await supabase
      .from('payment_methods')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Elimina un método de pago con validación para no borrar los del sistema.
   */
  async deletePaymentMethod(id) {
    // Check if it's a system method first (optional double check, backend RLS could also do it)
    const { data: method } = await supabase
      .from('payment_methods')
      .select('is_system')
      .eq('id', id)
      .single();

    if (method?.is_system) {
      throw new Error('No se pueden eliminar métodos de pago del sistema.');
    }

    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
