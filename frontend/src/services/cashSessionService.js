import { supabase } from '../supabase';
import { terminalService } from './terminalService';
import { isAbortError } from '../utils/supabaseErrorHandler';

export const cashSessionService = {
    /**
     * Obtiene la sesión de caja activa del usuario actual en ESTA terminal
     */
    async getActiveSession() {
        const terminalId = terminalService.getTerminalId();
        if (!terminalId) return null;

        const { data, error } = await supabase
            .from('cash_sessions')
            .select('*')
            .eq('status', 'open')
            .eq('terminal_id', terminalId)
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
             if (!isAbortError(error)) {
                console.error('Error obteniendo sesión activa:', error);
             }
             if (isAbortError(error)) return null;
             throw error;
        }

        return data;
    },

    /**
     * Abre una nueva sesión de caja con el fondo inicial
     */
    async openSession(staffName, openingFund, staffId = null) {
        const terminalId = terminalService.getTerminalId();
        if (!terminalId) throw new Error("Terminal no configurada");

        const { data, error } = await supabase
            .from('cash_sessions')
            .insert([{
                staff_name: staffName,
                staff_id: staffId,
                opening_fund: openingFund,
                status: 'open',
                opened_at: new Date().toISOString(),
                terminal_id: terminalId
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
    }
};
