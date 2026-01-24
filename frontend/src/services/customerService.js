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

    // Realizar consultas independientes para evitar errores de sintaxis con caracteres especiales en .or()
    const queries = [];

    if (name) {
      queries.push(
        supabase
          .from("customers")
          .select("id, name, phone")
          .eq("user_id", user.id)
          .eq("name", name) // .eq maneja correctamente espacios y caracteres
      );
    }

    if (phone) {
      queries.push(
        supabase
          .from("customers")
          .select("id, name, phone")
          .eq("user_id", user.id)
          .eq("phone", phone)
      );
    }

    if (queries.length === 0) return [];

    const results = await Promise.all(queries);
    
    // Combinar resultados y eliminar duplicados (si el mismo cliente coincide en nombre y teléfono)
    const allMatches = results.reduce((acc, result) => {
        if (result.data) {
            return [...acc, ...result.data];
        }
        return acc;
    }, []);

    // Desduplicar array de objetos por ID
    const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.id, item])).values());

    return uniqueMatches;
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
