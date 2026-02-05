import { supabase } from '../supabase';

export const adminLicenseService = {
    /**
     * Obtiene la lista de todos los perfiles (tiendas) registrados.
     * Requiere rol 'super_admin' y PIN Maestro.
     */
    getProfiles: async (masterPin) => {
        try {
            const { data, error } = await supabase.rpc('get_admin_profiles', {
                master_pin: masterPin
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error fetching admin profiles:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Actualiza la fecha de vencimiento de la licencia de un usuario.
     */
    updateLicense: async (userId, newDate, masterPin) => {
        try {
            const { data, error } = await supabase.rpc('update_license_expiry', {
                target_user_id: userId,
                new_expiry: newDate,
                master_pin: masterPin
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating license:', error);
            return { success: false, error: error.message };
        }
    }
};
