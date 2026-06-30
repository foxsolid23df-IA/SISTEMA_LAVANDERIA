import { supabase } from '../supabase';

export const invitationService = {
    // Validar si un código de invitación es válido y no ha sido usado
    validateCode: async (code) => {
        if (!code || typeof code !== 'string') {
            return { valid: false, error: 'Código de invitación requerido' };
        }

        try {
            const codeTrimmed = code.trim();
            const codeUpper = codeTrimmed.toUpperCase();
            const codeLower = codeTrimmed.toLowerCase();
            const codeCandidates = [...new Set([codeTrimmed, codeUpper, codeLower])];

            // Buscar el código en la base de datos
            const { data, error } = await supabase
                .from('invitation_codes')
                .select('id, code, used, expires_at')
                .in('code', codeCandidates)
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('Error validando código:', error);
                return { valid: false, error: 'Error al validar el código de invitación' };
            }

            // Si el código no existe
            if (!data) {
                return { valid: false, error: 'Código de invitación inválido. Solo el área administrativa puede proporcionar códigos de registro.' };
            }

            // Si el código ya fue usado
            if (data.used) {
                return { valid: false, error: 'Este código de invitación ya fue utilizado. Cada código solo puede usarse una vez.' };
            }

            // Si el código ha expirado
            if (data.expires_at) {
                const now = new Date();
                const expiresAt = new Date(data.expires_at);
                if (now > expiresAt) {
                    return { valid: false, error: 'Este código de invitación ha expirado.' };
                }
            }

            // Código válido
            return { 
                valid: true, 
                codeId: data.id,
                code: data.code 
            };
        } catch (error) {
            console.error('Error validando código de invitación:', error);
            return { valid: false, error: 'Error al validar el código de invitación' };
        }
    },

    // Marcar un código como usado después de un registro exitoso
    markAsUsed: async (codeId, userId) => {
        try {
            const { error } = await supabase
                .from('invitation_codes')
                .update({
                    used: true,
                    used_by: userId,
                    used_at: new Date().toISOString()
                })
                .eq('id', codeId);

            if (error) {
                console.error('Error marcando código como usado:', error);
                throw error;
            }

            return { success: true };
        } catch (error) {
            console.error('Error marcando código como usado:', error);
            throw error;
        }
    },

    // Obtener todos los códigos (solo para administración - opcional)
    getAllCodes: async () => {
        try {
            const { data, error } = await supabase
                .from('invitation_codes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error obteniendo códigos:', error);
            throw error;
        }
    }
};
