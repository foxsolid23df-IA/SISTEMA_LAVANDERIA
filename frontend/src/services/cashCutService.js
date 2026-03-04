import { supabase } from '../supabase';
import { salesService } from './salesService';
import { terminalService } from './terminalService';
import { orderService } from './orderService';
import { cashWithdrawalService } from './cashWithdrawalService';

export const cashCutService = {
    // Obtener el último corte de caja (para saber dónde empezó el turno)
    getLastCut: async () => {
        try {
            const { data, error } = await supabase
                .from('cash_cuts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error en getLastCut:', error);
                throw error;
            }
            return data;
        } catch (error) {
            console.error('Excepción en getLastCut:', error);
            return null;
        }
    },

    // Obtener el último corte DE TIPO DÍA
    getLastDayCut: async () => {
        const { data, error } = await supabase
            .from('cash_cuts')
            .select('*')
            .eq('cut_type', 'dia')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    // Obtener ventas desde una fecha
    getSalesSince: async (startTime) => {
        return await salesService.getSalesSince(startTime);
    },

    // Obtener ventas del día actual
    getTodaySales: async () => {
        return await salesService.getTodaySales();
    },

    // Crear un corte de caja
    createCashCut: async (cutData) => {
        const { data: userData } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('cash_cuts')
            .insert([{
                staff_name: cutData.staffName,
                staff_role: cutData.staffRole,
                cut_type: cutData.cutType, // 'turno' | 'dia' | 'parcial'
                start_time: cutData.startTime,
                end_time: new Date().toISOString(),
                sales_count: cutData.salesCount,
                sales_total: cutData.salesTotal,
                expected_cash: cutData.expectedCash,
                actual_cash: cutData.actualCash || null,
                difference: cutData.difference,
                expected_usd: cutData.expectedUSD || 0,
                actual_usd: cutData.actualUSD || 0,
                difference_usd: cutData.differenceUSD || 0,
                card_total: cutData.cardTotal || 0,
                transfer_total: cutData.transferTotal || 0,
                notes: cutData.notes || null,
                user_id: userData.user.id,
                terminal_id: terminalService.getTerminalId()
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Verificar si hay sesiones abiertas en OTRAS terminales
    checkBlockingSessions: async () => {
        const currentTerminalId = terminalService.getTerminalId();
        if (!currentTerminalId) return [];

        // Buscar sesiones abiertas en terminales distintas a la actual
        const { data, error } = await supabase
            .from('cash_sessions')
            .select(`
                *,
                terminals (name)
            `) // Usamos staff_name que ya está en la tabla
            .eq('status', 'open')
            .neq('terminal_id', currentTerminalId);

        if (error) {
            console.error('Error verificando sesiones bloqueantes:', error);
            throw error;
        }

        return data || [];
    },

    // Obtener historial de cortes con filtros
    getCashCuts: async (options = {}) => {
        const { limit = 50, staffName, startDate, endDate, cutType } = options;

        let query = supabase
            .from('cash_cuts')
            .select('*')
            .order('created_at', { ascending: false });

        if (staffName) {
            query = query.ilike('staff_name', `%${staffName}%`);
        }

        if (startDate) {
            query = query.gte('created_at', startDate);
        }

        if (endDate) {
            // Ajustar endDate para incluir todo el día
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query = query.lte('created_at', end.toISOString());
        }

        if (cutType && cutType !== 'all') {
            query = query.eq('cut_type', cutType);
        }

        const { data, error } = await query.limit(limit);

        if (error) throw error;
        return data || [];
    },

    // Calcular resumen de turno actual o día
    getCurrentShiftSummary: async (cutType = 'turno') => {
        let startTime = null;
        let sales = [];
        let withdrawals = { totalMXN: 0, totalUSD: 0, count: 0 };

        try {
            if (cutType === 'turno') {
                const terminalId = terminalService.getTerminalId();

                if (terminalId) {
                    // Validar si es un UUID válido para evitar errores de Postgres
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (!uuidRegex.test(terminalId)) {
                        console.error('ID de terminal inválido:', terminalId);
                        throw new Error(`ID de terminal inválido: ${terminalId}`);
                    }

                    const { data: session, error: sessionError } = await supabase
                        .from('cash_sessions')
                        .select('id, opened_at')
                        .eq('terminal_id', terminalId)
                        .eq('status', 'open')
                        .order('opened_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (sessionError && sessionError.code !== 'PGRST116') {
                        console.error('Error buscando sesión:', sessionError);
                    }

                    if (session && session.opened_at) {
                        startTime = session.opened_at;
                        // Fetch withdrawals for this session
                        withdrawals = await cashWithdrawalService.getTotalWithdrawalsBySession(session.id);

                        // Si tenemos la sesión, podemos buscar órdenes por ID de sesión para mayor precisión
                        const sessionOrders = await orderService.getOrdersBySession(session.id);
                        sales = await salesService.getSalesSince(startTime, terminalId);

                        // Normalizar órdenes al formato de "venta" para el resumen
                        const normalizedOrders = sessionOrders.map(order => ({
                            ...order,
                            total: parseFloat(order.total),
                            // Mapeo de métodos de pago de órdenes a formato de ventas/corte
                            payment_method: order.payment_method === 'cash' ? 'efectivo' :
                                order.payment_method === 'card' ? 'tarjeta' :
                                    order.payment_method === 'usd_cash' ? 'dolares' :
                                        order.payment_method,
                            is_order: true,
                            // Si es USD, intentamos proveer el monto en USD para que aparezca en el resumen
                            // Aunque la tabla orders no lo tiene, si el método es usd_cash, el total es en MXN
                            // pero el pago fue en USD. Como no tenemos la tasa guardada en la orden, 
                            // dejamos amount_usd como null o 0, a menos que el sistema se actualice para guardarlo.
                            amount_usd: order.payment_method === 'usd_cash' ? 0 : 0
                        }));

                        sales = [...sales, ...normalizedOrders];
                    } else {
                        const lastCut = await cashCutService.getLastCut();
                        startTime = lastCut?.end_time || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

                        console.log(`[CashCut] No session found, falling back to last cut or today. StartTime: ${startTime}`);

                        sales = await salesService.getSalesSince(startTime, terminalId);

                        const ordersSince = await orderService.getOrdersSince(startTime);
                        const normalizedOrders = ordersSince.map(order => ({
                            ...order,
                            total: parseFloat(order.total),
                            payment_method: order.payment_method === 'cash' ? 'efectivo' :
                                order.payment_method === 'card' ? 'tarjeta' :
                                    order.payment_method === 'usd_cash' ? 'dolares' :
                                        order.payment_method,
                            is_order: true
                        }));
                        sales = [...sales, ...normalizedOrders];
                    }
                } else {
                    console.warn("Terminal ID not found in localStorage");
                    startTime = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
                    sales = await salesService.getSalesSince(startTime, null);
                    const ordersSince = await orderService.getOrdersSince(startTime);
                    sales = [...sales, ...ordersSince.map(o => ({
                        ...o,
                        total: parseFloat(o.total),
                        payment_method: o.payment_method === 'cash' ? 'efectivo' :
                            o.payment_method === 'card' ? 'tarjeta' :
                                o.payment_method === 'usd_cash' ? 'dolares' :
                                    o.payment_method,
                        is_order: true
                    }))];
                }
            } else {
                const lastDayCut = await cashCutService.getLastDayCut();
                startTime = lastDayCut?.end_time || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

                console.log(`[CashCut] Fetching day summary since: ${startTime}`);

                // Load all withdrawals since the last day cut
                const allWithdrawals = await cashWithdrawalService.getWithdrawalHistory({ startDate: startTime, limit: 1000 });
                const totalMXN = allWithdrawals.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
                withdrawals = {
                    totalMXN,
                    totalUSD: 0,
                    count: allWithdrawals.length,
                    details: allWithdrawals // <-- Agregamos el array para que el ticket pueda iterar sobre él
                };

                const cloudSales = await salesService.getSalesSince(startTime, null);
                const cloudOrders = await orderService.getOrdersSince(startTime);

                sales = [
                    ...cloudSales,
                    ...cloudOrders.map(o => ({
                        ...o,
                        total: parseFloat(o.total),
                        payment_method: o.payment_method === 'cash' ? 'efectivo' :
                            o.payment_method === 'card' ? 'tarjeta' :
                                o.payment_method === 'usd_cash' ? 'dolares' :
                                    o.payment_method,
                        is_order: true
                    }))
                ];
            }

            // --- FUSIÓN CON VENTAS OFFLINE (LOCALES) ---
            try {
                // Obtener ventas que aún no se han subido a la nube
                const localSales = await salesService.getLocalPendingSales();

                if (localSales.length > 0) {
                    const currentTerminalId = terminalService.getTerminalId();

                    const filteredLocalSales = localSales.filter(localSale => {
                        const saleDate = new Date(localSale.created_at);
                        const sessionStart = new Date(startTime);

                        // 1. Debe ser posterior al inicio del turno/día
                        if (saleDate < sessionStart) return false;

                        // 2. Si es corte de turno, debe coincidir la terminal
                        if (cutType === 'turno') {
                            // Si la venta local tiene terminal_id, comparamos
                            if (localSale.terminal_id && currentTerminalId) {
                                return localSale.terminal_id === currentTerminalId;
                            }
                        }
                        return true;
                    });

                    console.log(`[CashCut] Agregando ${filteredLocalSales.length} ventas locales al corte.`);
                    sales = [...sales, ...filteredLocalSales];

                    // Re-ordenar por fecha
                    sales.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                }
            } catch (e) {
                console.warn('[CashCut] No se pudieron cargar ventas offline:', e);
            }
            // ------------------------------------------

            // ------------------------------------------

            // RECALCULAR TOTALES con la lista unificada
            const salesCount = sales.length;
            const salesTotal = sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);

            // Calcular totales por método de pago para el resumen
            const cardTotal = sales
                .filter(s => s.payment_method === 'tarjeta')
                .reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);

            const transferTotal = sales
                .filter(s => s.payment_method === 'transferencia')
                .reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);

            const cashTotal = sales
                .filter(s => s.payment_method === 'efectivo')
                .reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);

            return {
                startTime,
                salesCount,
                salesTotal,
                cardTotal,
                transferTotal,
                cashTotal,
                sales,
                withdrawals
            };
        } catch (error) {
            console.error('Error detallado en getCurrentShiftSummary:', error);
            throw error;
        }
    }
};
