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
                opening_fund: cutData.opening_fund || 0,
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
        
        const cuts = data || [];

        // Fallback: Para cortes sin opening_fund, buscar en cash_sessions
        const cutsWithoutFund = cuts.filter(c => !c.opening_fund || parseFloat(c.opening_fund) === 0);
        if (cutsWithoutFund.length > 0) {
            try {
                const terminalIds = [...new Set(cutsWithoutFund.map(c => c.terminal_id).filter(Boolean))];
                if (terminalIds.length > 0) {
                    const { data: sessions } = await supabase
                        .from('cash_sessions')
                        .select('id, terminal_id, opening_fund, opened_at, closed_at')
                        .in('terminal_id', terminalIds)
                        .gt('opening_fund', 0)
                        .order('opened_at', { ascending: false });

                    if (sessions?.length > 0) {
                        cutsWithoutFund.forEach(cut => {
                            const matchingSession = sessions.find(s =>
                                s.terminal_id === cut.terminal_id &&
                                new Date(s.opened_at) <= new Date(cut.end_time) &&
                                (!s.closed_at || new Date(s.closed_at) >= new Date(cut.start_time))
                            );
                            if (matchingSession) {
                                cut.opening_fund = matchingSession.opening_fund;
                            }
                        });
                    }
                }
            } catch (fallbackError) {
                console.warn('[CashCuts] No se pudo enriquecer opening_fund desde sesiones:', fallbackError);
            }
        }

        return cuts;
    },

    // Obtener detalles de un corte específico (Ventas + Órdenes)
    getCutDetails: async (startTime, endTime, terminalId = null) => {
        try {
            // Cargar ventas y órdenes en paralelo
            const [sales, orders] = await Promise.all([
                salesService.getSalesInRange(startTime, endTime, terminalId),
                orderService.getOrdersInRange(startTime, endTime, terminalId)
            ]);

            // Normalizar órdenes para que se vean como "ventas"
            const normalizedOrders = orders.map(order => ({
                ...order,
                total: parseFloat(order.total),
                payment_method: 
                    order.payment_method === 'cash' ? 'efectivo' :
                    order.payment_method === 'card' ? 'tarjeta' :
                    order.payment_method === 'transfer' ? 'transferencia' :
                    order.payment_method === 'usd_cash' ? 'dolares' :
                    order.payment_method?.toLowerCase() || 'efectivo',
                is_order: true,
                customer_name: order.customers?.name || 'Cliente General',
                items_summary: order.order_items?.map(it => it.product_name).join(', ')
            }));

            // Normalizar ventas de productos
            const normalizedSales = sales.map(sale => ({
                ...sale,
                total: parseFloat(sale.total),
                payment_method: 
                    sale.payment_method === 'cash' ? 'efectivo' :
                    sale.payment_method === 'card' ? 'tarjeta' :
                    sale.payment_method === 'transfer' ? 'transferencia' :
                    sale.payment_method === 'usd_cash' ? 'dolares' :
                    sale.payment_method?.toLowerCase() || 'efectivo',
                is_sale: true,
                customer_name: 'Venta de Mostrador',
                items_summary: sale.sale_items?.map(it => it.product_name).join(', ')
            }));

            return {
                transactions: [...normalizedSales, ...normalizedOrders].sort((a, b) => 
                    new Date(b.created_at) - new Date(a.created_at)
                ),
                startTime,
                endTime
            };
        } catch (error) {
            console.error('Error in getCutDetails:', error);
            throw error;
        }
    },

    // Calcular resumen de turno actual o día
    getCurrentShiftSummary: async (cutType = 'turno') => {
        let startTime = null;
        let sales = [];
        let withdrawals = { totalMXN: 0, totalUSD: 0, count: 0 };

        try {
            if (cutType === 'turno') {
                // Buscamos la sesión activa global (independiente de en qué terminal estemos)
                const session = await cashSessionService.getActiveSession();

                if (session && session.opened_at) {
                    startTime = session.opened_at;
                    // Fetch withdrawals for this session
                    withdrawals = await cashWithdrawalService.getTotalWithdrawalsBySession(session.id);

                    // Buscamos órdenes y ventas globales para el negocio desde que se abrió esta sesión
                    const sessionOrders = await orderService.getOrdersBySession(session.id);
                    sales = await salesService.getSalesSince(startTime, null); // null = todas las terminales

                    // Normalizar órdenes al formato de "venta" para el resumen
                    const normalizedOrders = (sessionOrders || []).map(order => ({
                        ...order,
                        total: parseFloat(order.total || 0),
                        payment_method: order.payment_method === 'cash' ? 'efectivo' :
                            order.payment_method === 'card' ? 'tarjeta' :
                                order.payment_method === 'usd_cash' ? 'dolares' :
                                    order.payment_method,
                        currency: order.payment_method === 'usd_cash' ? 'USD' : 'MXN',
                        is_order: true,
                        amount_usd: order.payment_method === 'usd_cash' ? (parseFloat(order.total) / (parseFloat(session.exchange_rate) || 20)) : 0
                    }));

                    sales = [...sales, ...normalizedOrders];
                } else {
                    const lastCut = await cashCutService.getLastCut();
                    startTime = lastCut?.end_time || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

                    console.log(`[CashCut] No session found, falling back to last cut or today. StartTime: ${startTime}`);

                    sales = await salesService.getSalesSince(startTime, null); // Global

                    const ordersSince = await orderService.getOrdersSince(startTime);
                    if (ordersSince && ordersSince.length > 0) {
                        const normalizedOrders = ordersSince.map(order => ({
                            ...order,
                            total: parseFloat(order.total || 0),
                            payment_method: order.payment_method === 'cash' ? 'efectivo' :
                                order.payment_method === 'card' ? 'tarjeta' :
                                    order.payment_method === 'usd_cash' ? 'dolares' :
                                        order.payment_method,
                            currency: order.payment_method === 'usd_cash' ? 'USD' : 'MXN',
                            is_order: true,
                            amount_usd: order.payment_method === 'usd_cash' ? (parseFloat(order.total) / 20) : 0
                        }));
                        sales = [...sales, ...normalizedOrders];
                    }
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
