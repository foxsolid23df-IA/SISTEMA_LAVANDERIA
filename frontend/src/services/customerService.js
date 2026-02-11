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

  // Crear múltiples clientes (Carga Masiva)
  async bulkCreateCustomers(customers) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No authenticated user");

    // Preparar datos con el user_id
    const customersWithUser = customers.map(c => ({
      ...c,
      user_id: user.id
    }));

    const { data, error } = await supabase
      .from("customers")
      .insert(customersWithUser)
      .select();

    if (error) throw error;
    return data;
  },
};
