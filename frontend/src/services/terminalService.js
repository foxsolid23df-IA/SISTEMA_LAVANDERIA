import { supabase } from '../supabase';

const TERMINAL_ID_KEY = 'pos_terminal_id';
const TERMINAL_NAME_KEY = 'pos_terminal_name';

export const terminalService = {
    getTerminalId: () => localStorage.getItem(TERMINAL_ID_KEY),
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
            .eq('is_active', true) // Solo terminales activas
            .order('name');
         if (error) throw error;
         return data;
    },

    async deleteTerminal(id) {
        // En un sistema contable, no borramos físicamente si hay historial. 
        // Inactivamos la terminal (Soft Delete).
        const { error } = await supabase
            .from('terminals')
            .update({ is_active: false })
            .eq('id', id);
        
        if (error) throw error;
        
        // Si inactivamos la terminal actual, limpiar localStorage
        if (id === this.getTerminalId()) {
            this.resetLocalTerminal();
        }
        return true;
    },
    
    // Función para resetear la terminal local (útil para pruebas o reconfiguración)
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
            // Pequeña espera para asegurar que la sesión de Supabase esté estable
            await new Promise(resolve => setTimeout(resolve, 500));

            const { data, error } = await supabase
                .from('terminals')
                .select('id, name')
                .eq('id', terminalId)
                .maybeSingle(); // Usar maybeSingle para evitar errores si no existe

            if (error) {
                console.error('[TerminalService] Error de DB validando terminal:', error);
                // Si es un error de red o similar, no borrar configuración
                return true; 
            }

            if (!data) {
                console.warn(`[TerminalService] La terminal ${terminalId} no existe en la base de datos.`);
                // Solo borrar si estamos SEGUROS de que no existe (es decir, data es null y no hay error)
                this.resetLocalTerminal();
                return false;
            }

            console.log(`[TerminalService] Resultado validación:`, data);
            return !!data;
        } catch (err) {
            console.error('[TerminalService] Error crítico en validación:', err);
            return true; // No borrar en caso de error desconocido
        }
    }
};
