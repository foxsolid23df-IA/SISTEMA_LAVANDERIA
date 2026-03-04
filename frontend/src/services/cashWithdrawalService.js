import { supabase } from '../supabase';
import * as XLSX from 'xlsx';

export const cashWithdrawalService = {
    /**
     * Create a new cash withdrawal record
     */
    createWithdrawal: async (withdrawalData) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');

        const { data, error } = await supabase
            .from('cash_withdrawals')
            .insert([{
                amount: withdrawalData.amount,
                currency: withdrawalData.currency || 'MXN',
                reason: withdrawalData.reason,
                notes: withdrawalData.notes || null,
                staff_id: withdrawalData.staff_id,
                staff_name: withdrawalData.staff_name,
                cash_session_id: withdrawalData.cash_session_id,
                terminal_id: withdrawalData.terminal_id,
                user_id: user.id
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Get withdrawals for a specific cash session
     */
    getWithdrawalsBySession: async (sessionId) => {
        const { data, error } = await supabase
            .from('cash_withdrawals')
            .select('*')
            .eq('cash_session_id', sessionId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Get total withdrawals amount for a session
     */
    getTotalWithdrawalsBySession: async (sessionId) => {
        const { data, error } = await supabase
            .from('cash_withdrawals')
            .select('*')
            .eq('cash_session_id', sessionId);

        if (error) throw error;

        const totalMXN = (data || [])
            .filter(w => w.currency === 'MXN')
            .reduce((sum, w) => sum + parseFloat(w.amount), 0);

        const totalUSD = (data || [])
            .filter(w => w.currency === 'USD')
            .reduce((sum, w) => sum + parseFloat(w.amount), 0);

        return { totalMXN, totalUSD, count: data?.length || 0, details: data || [] };
    },

    /**
     * Get withdrawal history with optional date filters
     */
    getWithdrawalHistory: async (filters = {}) => {
        let query = supabase
            .from('cash_withdrawals')
            .select('*, cash_sessions(opened_at, closed_at)')
            .order('created_at', { ascending: false });

        if (filters.startDate) {
            query = query.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
            query = query.lte('created_at', filters.endDate);
        }
        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    /**
     * Export withdrawals to Excel file
     */
    exportToExcel: (withdrawals, filename = 'retiros_caja') => {
        const exportData = withdrawals.map(w => ({
            'Fecha': new Date(w.created_at).toLocaleString('es-MX'),
            'Monto': parseFloat(w.amount).toFixed(2),
            'Moneda': w.currency,
            'Motivo': w.reason,
            'Notas': w.notes || '',
            'Empleado': w.staff_name || 'N/A'
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Retiros');

        // Auto-size columns
        const colWidths = [
            { wch: 20 }, // Fecha
            { wch: 12 }, // Monto
            { wch: 8 },  // Moneda
            { wch: 30 }, // Motivo
            { wch: 25 }, // Notas
            { wch: 15 }  // Empleado
        ];
        worksheet['!cols'] = colWidths;

        const date = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `${filename}_${date}.xlsx`);
    }
};
