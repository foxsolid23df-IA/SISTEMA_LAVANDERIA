import { supabase } from '../supabase';

const TERMINAL_ID_KEY = 'pos_terminal_id';
const TERMINAL_NAME_KEY = 'pos_terminal_name';

export const terminalService = {
    getTerminalId() {
        return localStorage.getItem(TERMINAL_ID_KEY);
    },

    setTerminalId(id) {
        if (id) {
            localStorage.setItem(TERMINAL_ID_KEY, id);
        } else {
            localStorage.removeItem(TERMINAL_ID_KEY);
        }
    },

    getTerminalName: () => localStorage.getItem(TERMINAL_NAME_KEY),

    async registerTerminal(name, location = '', isMain = false) {
        // Enforcing Single Main Register Rule:
        if (isMain) {
            await supabase
                .from('terminals')
                .update({ is_main: false })
                .eq('is_main', true);
        }

        // NO buscamos por nombre para reutilizar. 
        // Cada registro en cada PC debe ser una terminal ÚNICA en la DB.
        // Si el usuario usa el mismo nombre, se crea un nuevo registro con ID único.
        // Esto evita que dos PCs compartan el mismo ID de terminal y por tanto la misma sesión de caja.

        const { data, error } = await supabase
            .from('terminals')
            .insert([{
                name: name.trim(),
                location: location.trim(),
                is_main: isMain
            }])
            .select()
            .single();

        if (error) throw error;

        localStorage.setItem(TERMINAL_ID_KEY, data.id);
        localStorage.setItem(TERMINAL_NAME_KEY, data.name);
        return data;
    },

    async getTerminals() {
        const { data, error } = await supabase
            .from('terminals')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error obteniendo terminales:', error);
            throw error;
        }

        return data || [];
    },

    async deleteTerminal(id) {
        // En un sistema contable, no borramos físicamente si hay historial. 
        // Inactivamos la terminal (Soft Delete).
        const { error } = await supabase
            .from('terminals')
            .update({ active: false })
            .eq('id', id);

        if (error) throw error;

        // Si inactivamos la terminal actual, limpiar localStorage
        if (id === this.getTerminalId()) {
            this.resetLocalTerminal();
        }
        return true;
    },

    resetLocalTerminal() {
        localStorage.removeItem(TERMINAL_ID_KEY);
        localStorage.removeItem(TERMINAL_NAME_KEY);
    },

    async checkIfMainTerminal() {
        const terminalId = this.getTerminalId();
        if (!terminalId) return false;

        const { data, error } = await supabase
            .from('terminals')
            .select('is_main')
            .eq('id', terminalId)
            .single();

        if (error) {
            console.error('Error verificando terminal principal:', error);
            return false;
        }

        return data?.is_main || false;
    },

    /**
     * Valida si el ID de terminal en localStorage realmente existe en la DB
     * Y pertenece al usuario actual (para evitar conflictos entre usuarios)
     */
    async validateTerminalExistence() {
        const terminalId = this.getTerminalId();
        const terminalName = this.getTerminalName();

        console.log(`[TerminalService] Validando terminal: ${terminalName} (${terminalId})`);

        if (!terminalId || terminalId === 'undefined' || terminalId === 'null') {
            console.log('[TerminalService] No hay terminal válida configurada localmente.');
            this.resetLocalTerminal();
            return false;
        }

        try {
            // Obtener el usuario actual
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError || !userData?.user) {
                console.warn('[TerminalService] No hay usuario autenticado');
                return false;
            }

            const currentUserId = userData.user.id;

            // Pequeña espera para asegurar que la sesión de Supabase esté estable
            await new Promise(resolve => setTimeout(resolve, 500));

            const { data, error } = await supabase
                .from('terminals')
                .select('id, name, user_id')
                .eq('id', terminalId)
                .maybeSingle(); // Usar maybeSingle para evitar errores si no existe

            if (error) {
                console.error('[TerminalService] Error de DB validando terminal:', error);
                // Si es un error de red o similar, no borrar configuración
                return true;
            }

            if (!data) {
                console.warn(`[TerminalService] La terminal ${terminalId} no existe en la base de datos.`);
                this.resetLocalTerminal();
                return false;
            }

            // CRÍTICO: Verificar que la terminal pertenezca al usuario actual
            if (data.user_id && data.user_id !== currentUserId) {
                console.warn(`[TerminalService] La terminal ${terminalId} pertenece a otro usuario. Reseteando configuración local.`);
                this.resetLocalTerminal();
                return false;
            }

            // Si existe en la BD pero no localmente (por ejemplo, después de un resetLocalTerminal)
            // se vuelve a guardar para asegurar persistencia
            if (!this.getTerminalId()) {
                this.setTerminalId(data.id);
            }

            console.log(`[TerminalService] Terminal validada correctamente:`, data);
            return true;
        } catch (err) {
            console.error('[TerminalService] Error crítico en validación:', err);
            return true; // No borrar en caso de error desconocido
        }
    }
};
