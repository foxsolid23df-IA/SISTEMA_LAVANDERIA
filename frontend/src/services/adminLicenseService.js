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
    },
    /**
     * Asciende o degrada a un usuario al rol de Super Admin.
     */
    toggleSuperAdmin: async (userId, makeAdmin, masterPin) => {
        try {
            const { data, error } = await supabase.rpc('toggle_super_admin_role', {
                target_user_id: userId,
                make_admin: makeAdmin,
                master_pin: masterPin
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error toggling admin role:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Crea un nuevo código de invitación para registrar nuevos negocios.
     * Usa RPC para bypasear políticas RLS.
     */
    createInvitationCode: async (code, notes, masterPin) => {
        try {
            const { data, error } = await supabase.rpc('create_invitation_code', {
                p_code: code,
                p_notes: notes,
                master_pin: masterPin
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error creating invitation code:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Elimina permanentemente un cliente y todos sus datos asociados.
     * ⚠️ ACCIÓN IRREVERSIBLE - Requiere rol super_admin y PIN Maestro.
     */
    deleteClient: async (userId, masterPin) => {
        try {
            const { data, error } = await supabase.rpc('delete_client_permanently', {
                target_user_id: userId,
                master_pin: masterPin
            });

            if (error) throw error;

            // La función RPC retorna JSONB con {success: bool, error?: string}
            if (!data?.success) {
                throw new Error(data?.error || 'Error al eliminar cliente');
            }

            return { success: true, data };
        } catch (error) {
            console.error('Error deleting client:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Cambia la contraseña de un cliente directamente.
     * Usa Edge Function que tiene acceso al Admin API de Supabase.
     */
    updateClientPassword: async (userId, newPassword, masterPin) => {
        try {
            // Llamar a Edge Function para cambiar contraseña
            const { data, error } = await supabase.functions.invoke('admin-update-password', {
                body: {
                    user_id: userId,
                    new_password: newPassword,
                    master_pin: masterPin
                }
            });

            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'Error al cambiar contraseña');

            return { success: true };
        } catch (error) {
            console.error('Error updating client password:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Limpia todo el catálogo de productos y servicios de un cliente.
     * Permite rehacer la carga inicial.
     */
    clearClientCatalog: async (userId, masterPin) => {
        try {
            const { data, error } = await supabase.rpc('clear_client_catalog', {
                target_user_id: userId,
                master_pin: masterPin
            });

            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'Error al limpiar catálogo');

            return { success: true, count: data.deleted_count };
        } catch (error) {
            console.error('Error clearing catalog:', error);
            return { success: false, error: error.message };
        }
    }
};
