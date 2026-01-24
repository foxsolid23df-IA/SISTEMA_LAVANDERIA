import { supabase } from "../supabase";

export const customerService = {
  // Obtener todos los clientes del usuario actual
  async getCustomers() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No authenticated user");

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) throw error;
    return data;
  },

  // Buscar clientes por nombre o teléfono
  async searchCustomers(query) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No authenticated user");

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(10);

    if (error) throw error;
    return data;
  },

  // Crear un nuevo cliente
  async createCustomer(customerData) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No authenticated user");

    const { data, error } = await supabase
      .from("customers")
      .insert([
        {
          ...customerData,
          user_id: user.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Verificar si existe un cliente con el mismo nombre O teléfono
  async checkDuplicate(name, phone) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No authenticated user");

    let query = supabase
      .from("customers")
      .select("id, name, phone")
      .eq("user_id", user.id);

    const conditions = [];
    if (name) conditions.push(`name.eq.${name}`);
    if (phone) conditions.push(`phone.eq.${phone}`);

    if (conditions.length > 0) {
      query = query.or(conditions.join(','));
    } else {
      return []; // Si no hay nombre ni teléfono, no hay duplicado que buscar
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Actualizar un cliente existente
  async updateCustomer(id, customerData) {
    const { data, error } = await supabase
      .from("customers")
      .update(customerData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Eliminar un cliente
  async deleteCustomer(id) {
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },
};
