import { supabase } from '../supabase';
import { terminalService } from './terminalService';
import { isAbortError } from '../utils/supabaseErrorHandler';

export const cashSessionService = {
    /**
     * Obtiene la sesión de caja activa del usuario actual
     */
    async getActiveSession() {
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) return null;

            const { data, error } = await supabase
                .from('cash_sessions')
                .select(`
                    *,
                    terminals (name)
                `)
                .eq('user_id', userData.user.id)
                .eq('status', 'open')
                .maybeSingle();

            if (error) {
                console.error('Error en getActiveSession:', error);
                return null;
            }
            return data;
        } catch (error) {
            console.error('Excepción en getActiveSession:', error);
            return null;
        }
    },

    /**
     * Busca SI HAY ALGUNA SESIÓN ABIERTA en cualquier terminal de este comercio.
     * Útil para detectar si el usuario olvidó cerrar sesión en otro equipo 
     * o si hubo un cambio de terminal_id accidental.
     */
    async getGlobalActiveSession() {
        const { data, error } = await supabase
            .from('cash_sessions')
            .select('*, terminals(name)')
            .eq('status', 'open')
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
             console.error('Error obteniendo sesión global activa:', error);
             return null;
        }

        return data;
    },

    /**
     * Abre una nueva sesión de caja con el fondo inicial
     */
    async openSession(staffName, openingFund, staffId = null) {
        // Verificar si ya existe una sesión activa global
        const active = await this.getActiveSession();
        if (active) {
            console.warn('[Session] Ya existe una sesión activa:', active.id);
            return active;
        }

        const terminalId = terminalService.getTerminalId();
        if (!terminalId) throw new Error('Terminal no configurada');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');

        const { data, error } = await supabase
            .from('cash_sessions')
            .insert([{
                user_id: user.id,
                terminal_id: terminalId,
                staff_name: staffName,
                staff_id: staffId,
                opening_fund: openingFund,
                status: 'open',
                opened_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            console.error('Error abriendo sesión de caja:', error);
            throw error;
        }

        return data;
    },

    /**
     * Cierra la sesión de caja actual
     */
    async closeSession(sessionId) {
        const { data, error } = await supabase
            .from('cash_sessions')
            .update({
                status: 'closed',
                closed_at: new Date().toISOString()
            })
            .eq('id', sessionId)
            .select()
            .single();

        if (error) {
            console.error('Error cerrando sesión de caja:', error);
            throw error;
        }

        return data;
    },

    /**
     * Obtiene el historial de sesiones de caja
     */
    async getSessionHistory(limit = 10) {
        const { data, error } = await supabase
            .from('cash_sessions')
            .select('*, terminals(name)')
            .order('opened_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error obteniendo historial:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Cuenta cuántas sesiones de caja hay abiertas globalmente
     */
    async getOpenSessionsCount() {
        const { count, error } = await supabase
            .from('cash_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'open');

        if (error) {
            console.error('Error contando sesiones abiertas:', error);
            return 0;
        }

        return count || 0;
    }
};
