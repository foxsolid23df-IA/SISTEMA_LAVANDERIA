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

  // Verificar si existe un cliente con el mismo nombre, teléfono o email
  async checkDuplicate(field, value, excludeId = null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No authenticated user");
    if (!value) return null;

    let query = supabase
      .from("customers")
      .select("id, name, phone, email")
      .eq("user_id", user.id)
      .eq(field, value);

    // Si estamos editando, excluir el ID actual
    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data && data.length > 0 ? data[0] : null;
  },

  // Obtener estadísticas e historial de un cliente
  async getCustomerStats(customerId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No authenticated user");

    // Obtener órdenes del cliente
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Calcular estadísticas
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const pendingPayment = orders.reduce((sum, order) => {
      const balance = (order.total || 0) - (order.paid_amount || 0);
      return sum + Math.max(0, balance);
    }, 0);

    return {
      orders: orders || [],
      stats: {
        totalOrders,
        totalSpent,
        pendingPayment
      }
    };
  }
};
