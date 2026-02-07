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
            return { success: true, data };
        } catch (error) {
            console.error('Error deleting client:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Envía un correo de reset de contraseña a un cliente.
     * Usa la API de autenticación de Supabase.
     */
    resetClientPassword: async (email, masterPin) => {
        try {
            // Primero validamos que el caller tenga permisos (via RPC)
            const { data: validation, error: validationError } = await supabase.rpc('validate_super_admin', {
                master_pin: masterPin
            });

            if (validationError || !validation?.success) {
                throw new Error(validation?.error || 'No tienes permisos para esta acción');
            }

            // Enviar correo de reset usando la API pública de Supabase Auth
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/#/reset-password`
            });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error sending reset password email:', error);
            return { success: false, error: error.message };
        }
    }
};
