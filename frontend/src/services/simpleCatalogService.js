import { supabase } from '../supabase';

export const simpleCatalogService = {
  // Obtener servicios del usuario actual
  getAll: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'SERVICE')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Crear servicio
  create: async (serviceData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No hay sesión activa.");

    const { data, error } = await supabase
      .from('products')
      .insert([{
        user_id: user.id,
        name: serviceData.name,
        price: parseFloat(serviceData.price || 0),
        cost_price: parseFloat(serviceData.cost_price || 0),
        category: serviceData.category || 'General',
        pricing_type: serviceData.pricing_type || 'unit',
        unit_type: serviceData.unit_type || 'PZA',
        type: 'SERVICE',
        stock: 999999,
        catalog_source: 'express'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Actualizar servicio
  update: async (id, serviceData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No hay sesión activa.");

    const { data, error } = await supabase
      .from('products')
      .update({
        name: serviceData.name,
        price: parseFloat(serviceData.price || 0),
        cost_price: parseFloat(serviceData.cost_price || 0),
        category: serviceData.category || 'General',
        pricing_type: serviceData.pricing_type || 'unit',
        unit_type: serviceData.unit_type || 'PZA',
        catalog_source: 'express'
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Eliminar servicio
  delete: async (id) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No hay sesión activa.");

    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  }
};

export default simpleCatalogService;
