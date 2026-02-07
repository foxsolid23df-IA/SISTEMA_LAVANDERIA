
import { supabase } from '../supabase';

export const businessSettingsService = {
    // Obtener la configuración del negocio
    getSettings: async () => {
        // Obtenemos el primer registro, ya que asumimos una sola configuración por app
        const { data, error } = await supabase
            .from('business_settings')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            // Si no existe, podemos devolver un objeto vacío o null, 
            // pero si es error de conexión lanzamos error.
            if (error.code === 'PGRST116') { // Código de 'No rows found'
                return null;
            }
            throw error;
        }
        return data;
    },

    // Actualizar o crear la configuración
    saveSettings: async (settingsData) => {
        // Primero intentamos obtener el registro existente
        const existingSettings = await businessSettingsService.getSettings();

        if (existingSettings) {
            // Actualizar
            const { data, error } = await supabase
                .from('business_settings')
                .update({
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
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingSettings.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            // Crear nuevo
            const { data, error } = await supabase
                .from('business_settings')
                .insert([{
                    name: settingsData.name,
                    address: settingsData.address,
                    phone: settingsData.phone,
                    logo_url: settingsData.logo_url,
                    ticket_message: settingsData.ticket_message,
                    printer_width: settingsData.printer_width || 80,
                    printer_font_size: settingsData.printer_font_size || 12,
                    printer_font_family: settingsData.printer_font_family || 'Courier New',
                    printer_is_bold: settingsData.printer_is_bold || false,
                    printer_margin: settingsData.printer_margin || 0
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        }
    }
};
