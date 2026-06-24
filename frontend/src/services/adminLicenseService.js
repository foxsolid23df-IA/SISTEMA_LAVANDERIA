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
     * Obtiene la lista de administradores del portal.
     * Solo funciona si el usuario actual es super_admin (por RLS).
     */
    getSuperAdmins: async () => {
        try {
            const { data, error } = await supabase
                .from('super_admins')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error fetching super admins:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Crea un nuevo administrador con acceso al portal (sin crear tienda).
     */
    createSuperAdmin: async (email, password, masterPin) => {
        try {
            const { data, error } = await supabase.functions.invoke('admin-create-superadmin', {
                body: { email, password, master_pin: masterPin }
            });

            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'Error al crear administrador');

            return { success: true, data };
        } catch (error) {
            console.error('Error creating super admin:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Actualiza la fecha de vencimiento de la licencia de un usuario.
     */
    updateLicense: async (userId, newDate, masterPin) => {
        try {
            const { error } = await supabase.rpc('update_license_expiry', {
                target_user_id: userId,
                new_expiry: newDate,
                master_pin: masterPin
            });

            if (error) throw error;

            // También actualizar en invitation_codes (Prioridad del SuperAdmin Portal corporativo)
            // Ya que is_super_admin() aplica en RLS, la actualización directa está permitida
            const { error: invError } = await supabase
                .from('invitation_codes')
                .update({ expires_at: newDate })
                .eq('used_by', userId);

            if (invError) {
                console.warn("Fallo al actualizar invitation_codes, puede que no exista código para este user:", invError);
            }

            return { success: true };
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
    },

    /**
     * Obtiene los avisos remotos configurados para los clientes.
     */
    getRemoteNotices: async () => {
        try {
            const { data, error } = await supabase
                .from('remote_notices')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error fetching remote notices:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Crea o actualiza un aviso remoto.
     */
    saveRemoteNotice: async (notice) => {
        try {
            const payload = {
                user_id: notice.user_id,
                notice_key: notice.notice_key,
                title: notice.title,
                message: notice.message,
                events: notice.events,
                active: notice.active,
                starts_at: notice.starts_at || null,
                ends_at: notice.ends_at || null,
                button_text: notice.button_text || null,
                button_url: notice.button_url || null,
                updated_at: new Date().toISOString(),
            };

            const query = notice.id
                ? supabase.from('remote_notices').update(payload).eq('id', notice.id).select().single()
                : supabase.from('remote_notices').insert([{ ...payload, created_at: new Date().toISOString() }]).select().single();

            const { data, error } = await query;
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error saving remote notice:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Cambia el estado activo/inactivo de un aviso remoto.
     */
    toggleRemoteNotice: async (noticeId, active) => {
        try {
            const { data, error } = await supabase
                .from('remote_notices')
                .update({ active, updated_at: new Date().toISOString() })
                .eq('id', noticeId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error toggling remote notice:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Elimina un aviso remoto.
     */
    deleteRemoteNotice: async (noticeId) => {
        try {
            const { error } = await supabase
                .from('remote_notices')
                .delete()
                .eq('id', noticeId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting remote notice:', error);
            return { success: false, error: error.message };
        }
    }
};
