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

        // Limpiamos los campos que se guardarán
        const payloadToSave = {
            name: settingsData.name,
            address: settingsData.address,
            phone: settingsData.phone,
            logo_url: settingsData.logo_url,
            ticket_message: settingsData.ticket_message,
            printer_width: settingsData.printer_width || 80,
            printer_font_size: settingsData.printer_font_size || 12,
            printer_font_family: settingsData.printer_font_family || 'Courier New',
            printer_is_bold: settingsData.printer_is_bold || false,
            printer_margin: settingsData.printer_margin || 0,
            ticket_double_print: settingsData.ticket_double_print || false,
            billing_url: settingsData.billing_url || 'https://lavanderia-facturacion.vercel.app/',
            rfc: settingsData.rfc,
            razon_social: settingsData.razon_social,
            regimen_fiscal: settingsData.regimen_fiscal,
            codigo_postal: settingsData.codigo_postal,
            updated_at: new Date().toISOString()
        };

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
