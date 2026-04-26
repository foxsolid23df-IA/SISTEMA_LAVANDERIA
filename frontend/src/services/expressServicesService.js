import { supabase } from '../supabase';

export const expressServicesService = {
    // Obtener los servicios express del cliente actual
    getExpressServices: async () => {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("No hay una sesión activa");

        const { data, error } = await supabase
            .from('express_services')
            .select('*')
            .eq('user_id', user.id)
            .order('name', { ascending: true });

        if (error) throw error;
        return data;
    },

    // Agregar un nuevo servicio express
    addExpressService: async (name) => {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("No hay una sesión activa");

        if (!name || name.trim() === '') {
            throw new Error("El nombre no puede estar vacío");
        }

        const { data, error } = await supabase
            .from('express_services')
            .insert([{
                name: name.trim().toUpperCase(),
                user_id: user.id
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Actualizar un servicio express
    updateExpressService: async (id, name) => {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("No hay una sesión activa");

        if (!name || name.trim() === '') {
            throw new Error("El nombre no puede estar vacío");
        }

        const { data, error } = await supabase
            .from('express_services')
            .update({ name: name.trim().toUpperCase() })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Eliminar un servicio express
    deleteExpressService: async (id) => {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("No hay una sesión activa");

        const { error } = await supabase
            .from('express_services')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;
        return true;
    }
};
