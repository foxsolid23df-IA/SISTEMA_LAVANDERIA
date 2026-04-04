import { supabase } from '../supabase';

export const businessSettingsService = {
    // Obtener la configuración del negocio del cliente actual
    getSettings: async () => {
        // 1. Obtener el usuario actual
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("No hay una sesión activa");

        // Obtenemos el registro de configuración específico de este usuario
        const { data, error } = await supabase
            .from('business_settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    // Actualizar o crear la configuración
    saveSettings: async (settingsData) => {
        // 1. Obtener el usuario actual
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("No hay una sesión activa");

        // Primero intentamos obtener el registro existente
        const existingSettings = await businessSettingsService.getSettings();

        // Limpiamos y combinamos los campos que se guardarán
        const payloadToSave = {
            ...(existingSettings || {}),
            ...settingsData,
            updated_at: new Date().toISOString()
        };
        
        // Evitamos enviar campos inmutables
        delete payloadToSave.id;
        delete payloadToSave.user_id;
        delete payloadToSave.created_at;

        if (existingSettings && existingSettings.id) {
            // Actualizar el de este usuario en concreto
            const { data, error } = await supabase
                .from('business_settings')
                .update(payloadToSave)
                .eq('id', existingSettings.id)
                .eq('user_id', user.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            // Crear nuevo y atarlo al usuario en concreto
            const { data, error } = await supabase
                .from('business_settings')
                .insert([{
                    ...payloadToSave,
                    user_id: user.id
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        }
    }
};
