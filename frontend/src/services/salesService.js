import { supabase } from '../supabase';
import { terminalService } from './terminalService';
import { config } from '../config';

const LOCAL_SALES_URL = config.api.baseUrl + '/api/sales';

export const salesService = {
    // Crear una nueva venta
    createSale: async (saleData) => {
        const { data: userData } = await supabase.auth.getUser();
        const terminalId = terminalService.getTerminalId();

        if (!terminalId) {
            throw new Error("Terminal no configurada. No se puede realizar la venta.");
        }

        // --- FLUJO OFFLINE PRIMERO (INTENTO) ---
        // Si no hay internet o falla Supabase, enviamos al backend local (Electron)
        try {
            // Verificamos si podemos llegar a Supabase rÃ¡pidamente (opcional, o simplemente intentamos local si falla la nube)
            // Para asegurar mÃ¡xima resiliencia, si estamos en modo Electron, podemos intentar GUARDAR LOCAL primero
            // pero el requerimiento es "Garantizar ventas sin internet".

            // Si el navegador reporta offline, vamos directo a local
            if (!navigator.onLine) {
                if (config.isAndroid) {
                    throw new Error("El APK Android requiere internet para registrar ventas en esta version.");
                }
                const ticketUuid = crypto.randomUUID();
                const pinFacturacion = Math.floor(1000 + Math.random() * 9000).toString();
                return await salesService.saveToLocal({ ...saleData, ticket_uuid: ticketUuid, pin_facturacion: pinFacturacion }, userData?.user?.id, terminalId);
            }

            // 1. Generar PIN y UUID de facturaciÃ³n (si no existen)
            // GeneraciÃ³n de PIN de 4 dÃ­gitos numÃ©ricos (ej: 4821)
            const ticketUuid = crypto.randomUUID();
            const pinFacturacion = Math.floor(1000 + Math.random() * 9000).toString();

            // 1. Crear la venta principal en Supabase
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .insert([{
                    total: saleData.total,
                    user_id: userData?.user?.id,
                    currency: saleData.currency || 'MXN',
                    exchange_rate: saleData.exchange_rate || null,
                    amount_usd: saleData.amount_usd || null,
                    payment_method: saleData.metodoPago || 'efectivo',
                    terminal_id: terminalId,
                    has_tax: saleData.has_tax || false,
                    tax_amount: saleData.tax_amount || 0,
                    invoice_requested: saleData.invoice_requested || false,
                    ticket_uuid: ticketUuid,
                    pin_facturacion: pinFacturacion
                }])
                .select()
                .single();

            if (saleError) throw saleError;

            // 2. Crear los items de la venta
            const saleItems = saleData.items.map(item => ({
                sale_id: sale.id,
                product_id: item.id,
                product_name: item.name,
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity,
                barcode: item.barcode || null,
                user_id: userData?.user?.id
            }));

            const { error: itemsError } = await supabase
                .from('sale_items')
                .insert(saleItems);

            if (itemsError) throw itemsError;

            // 3. Actualizar stock
            const itemsForStockUpdate = saleData.items.map(item => ({
                id: item.id,
                quantity: item.quantity
            }));
            await supabase.rpc('decrement_stock', { items: itemsForStockUpdate });

            return { ...sale, pin_facturacion: pinFacturacion, ticket_uuid: ticketUuid };
        } catch (error) {
            if (config.isAndroid) {
                console.warn('[SalesService] Fallo en la nube en Android online-first:', error.message);
                throw new Error(error.message || "No se pudo registrar la venta. Verifica la conexion a internet.");
            }

            console.warn('[SalesService] Fallo en la nube, guardando en cola local...', error.message);
            // Si la nube fallÃ³, generamos los datos aquÃ­ antes de enviar a local
            const ticketUuid = crypto.randomUUID();
            const pinFacturacion = Math.floor(1000 + Math.random() * 9000).toString();
            
            return await salesService.saveToLocal({ 
                ...saleData, 
                ticket_uuid: ticketUuid, 
                pin_facturacion: pinFacturacion 
            }, userData?.user?.id, terminalId);
        }
    },

    /**
     * Guarda la venta en el SQLite local como 'pendiente'
     */
    saveToLocal: async (saleData, userId, terminalId) => {
        try {
            const response = await fetch(LOCAL_SALES_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    total: saleData.total,
                    items: saleData.items.map(i => ({
                        productId: i.id,
                        name: i.name,
                        quantity: i.quantity,
                        price: i.price
                    })),
                    payment_method: saleData.metodoPago || 'efectivo',
                    terminal_id: terminalId,
                    has_tax: saleData.has_tax || false,
                    tax_amount: saleData.tax_amount || 0,
                    invoice_requested: saleData.invoice_requested || false,
                    ticket_uuid: saleData.ticket_uuid,
                    pin_facturacion: saleData.pin_facturacion,
                    status: 'pending' // Importante para la sincronizaciÃ³n
                })
            });

            if (!response.ok) throw new Error('Error al guardar localmente');
            const localSale = await response.json();

            return {
                ...localSale,
                offline: true,
                message: 'Venta guardada localmente (pendiente de sincronizaciÃ³n)'
            };
        } catch (e) {
            console.error('[SalesService] Error fatal: No se pudo guardar ni en nube ni local.', e);
            throw e;
        }
    },

    /**
     * Sincroniza las ventas locales pendientes con Supabase
     */
    syncPendingSales: async () => {
        try {
            // 1. Obtener pendientes del backend local
            const response = await fetch(`${config.api.baseUrl}/api/admin/sync/sales/pending?masterPin=2026SOP`);
            const { sales } = await response.json();

            if (!sales || sales.length === 0) return { count: 0 };

            console.log(`[SalesService] Subiendo ${sales.length} ventas a la nube...`);
            let synced = 0;

            for (const localSale of sales) {
                try {
                    // Re-formatear para Supabase
                    const items = JSON.parse(localSale.items);
                    const cloudSaleData = {
                        total: localSale.total,
                        payment_method: localSale.payment_method,
                        terminal_id: localSale.terminal_id,
                        created_at: localSale.createdAt,
                        has_tax: localSale.has_tax || false,
                        tax_amount: localSale.tax_amount || 0,
                        invoice_requested: localSale.invoice_requested || false,
                        ticket_uuid: localSale.ticket_uuid,
                        pin_facturacion: localSale.pin_facturacion
                    };

                    // Implementar lÃ³gica de subida similar a createSale pero forzando nube
                    const { data: sale, error } = await supabase.from('sales').insert([cloudSaleData]).select().single();
                    if (error) throw error;

                    const saleItems = items.map(item => ({
                        sale_id: sale.id,
                        product_id: item.productId,
                        product_name: item.name,
                        quantity: item.quantity,
                        price: item.price,
                        total: item.price * item.quantity
                    }));
                    await supabase.from('sale_items').insert(saleItems);

                    await fetch(`${config.api.baseUrl}/api/admin/sync/sales/mark-synced?masterPin=2026SOP`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ localId: localSale.id, supabaseId: sale.id })
                    });

                    synced++;
                } catch (err) {
                    console.error(`[SalesService] Error al sincronizar venta ${localSale.id}:`, err);
                }
            }

            return { count: synced };
        } catch (error) {
            console.error('[SalesService] Error general en sincronizaciÃ³n:', error);
            throw error;
        }
    },

    /**
     * Obtiene las ventas locales pendientes y las normaliza al formato Supabase
     */
    getLocalPendingSales: async () => {
        try {
            // Usamos el mismo endpoint que el sync
            const response = await fetch(`${config.api.baseUrl}/api/admin/sync/sales/pending?masterPin=2026SOP`);
            if (!response.ok) return [];

            const { sales } = await response.json();
            if (!sales || !Array.isArray(sales)) return [];

            return sales.map(local => {
                let parsedItems = [];
                try {
                    parsedItems = typeof local.items === 'string' ? JSON.parse(local.items) : local.items;
                } catch (e) {
                    console.warn('Error parseando items locales:', e);
                }

                // Normalizar al formato que espera CashCut (y el resto del front)
                return {
                    id: `local_${local.id}`, // Prefijo para distinguir
                    total: parseFloat(local.total),
                    payment_method: local.payment_method,
                    currency: local.currency || 'MXN',
                    amount_usd: local.amount_usd,
                    exchange_rate: local.exchange_rate,
                    created_at: local.createdAt, // SQLite suele devolver createdAt
                    terminal_id: local.terminal_id,
                    sale_items: parsedItems.map(pi => ({
                        product_name: pi.name,
                        quantity: pi.quantity,
                        price: pi.price,
                        total: (pi.price * pi.quantity)
                    })),
                    has_tax: local.has_tax || false,
                    tax_amount: local.tax_amount || 0,
                    invoice_requested: local.invoice_requested || false,
                    is_local: true
                };
            });
        } catch (error) {
            console.warn('[SalesService] No se pudieron obtener ventas locales:', error);
            // Si falla (ej. el servicio local no corre), retornamos array vacÃ­o para no romper el flujo
            return [];
        }
    },

    // Obtener ventas de hoy
    getTodaySales: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .gte('created_at', today.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    // Obtener ventas en un rango de fechas
    getSalesInRange: async (startTime, endTime, terminalId = null) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        let query = supabase
            .from('sales')
            .select(`
                *,
                sale_items (*)
            `)
            .gte('created_at', startTime)
            .lte('created_at', endTime)
            .order('created_at', { ascending: false });

        if (terminalId) {
            query = query.eq('terminal_id', terminalId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    // Obtener ventas desde una fecha (con items)
    getSalesSince: async (startTime, terminalId = null) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        // ValidaciÃ³n de UUID para terminalId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        let query = supabase
            .from('sales')
            .select(`
                *,
                sale_items (*)
            `)
            .gte('created_at', startTime)
            .order('created_at', { ascending: false });

        if (terminalId && uuidRegex.test(terminalId)) {
            query = query.eq('terminal_id', terminalId);
        } else if (terminalId) {
            console.warn('getSalesSince: terminalId provisto no es un UUID vÃ¡lido:', terminalId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    },

    // Obtener todas las ventas (con paginaciÃ³n)
    getSales: async (limit = 50) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('sales')
            .select(`
                *,
                sale_items (*),
                staff:user_id (name:full_name, email)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    // Obtener detalle de una venta
    getSaleDetails: async (saleId) => {
        const { data, error } = await supabase
            .from('sale_items')
            .select('*')
            .eq('sale_id', saleId);

        if (error) throw error;
        return data || [];
    },

    // Obtener estadÃ­sticas generales
    getStatistics: async (signal) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const ahora = new Date();
        const inicioDelDia = new Date(ahora);
        inicioDelDia.setHours(0, 0, 0, 0);

        const finDelDia = new Date(ahora);
        finDelDia.setHours(23, 59, 59, 999);

        const diaActual = ahora.getDay();
        const diasHastaLunes = diaActual === 0 ? 6 : diaActual - 1;
        const inicioSemana = new Date(ahora);
        inicioSemana.setDate(ahora.getDate() - diasHastaLunes);
        inicioSemana.setHours(0, 0, 0, 0);

        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);

        const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1, 0, 0, 0, 0);
        const finMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59, 999);

        console.log('[salesService] Consultando ventas desde Supabase...')

        // Obtener todas las ventas para cÃ¡lculos (Limitado a las Ãºltimas 2000 para evitar bloqueos)
        let query = supabase
            .from('sales')
            .select('total, created_at')
            .order('created_at', { ascending: false })
            .limit(2000);

        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data: todasVentas, error: ventasError } = await query;

        if (ventasError) {
            throw ventasError;
        }

        // Calcular estadÃ­sticas
        const ventasTotales = todasVentas.length;
        const ingresosTotales = todasVentas.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);

        // Ventas de hoy
        const ventasDeHoy = todasVentas.filter(v => {
            const fecha = new Date(v.created_at);
            return fecha >= inicioDelDia && fecha <= finDelDia;
        });
        const ingresosDeHoy = ventasDeHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);

        // Ventas de esta semana
        const ventasSemana = todasVentas.filter(v => new Date(v.created_at) >= inicioSemana);
        const ingresosSemana = ventasSemana.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);

        // Ventas de este mes
        const ventasMes = todasVentas.filter(v => new Date(v.created_at) >= inicioMes);
        const ingresosMes = ventasMes.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);

        // Ventas del mes anterior
        const ventasMesAnterior = todasVentas.filter(v => {
            const fecha = new Date(v.created_at);
            return fecha >= inicioMesAnterior && fecha <= finMesAnterior;
        });
        const ingresosMesAnterior = ventasMesAnterior.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);

        // Calcular crecimiento
        const crecimiento = ingresosMesAnterior > 0
            ? ((ingresosMes - ingresosMesAnterior) / ingresosMesAnterior) * 100
            : (ingresosMes > 0 ? 100 : 0);

        return {
            ventasTotales,
            ingresosTotales,
            ventasDeHoy: ventasDeHoy.length,
            ingresosDeHoy,
            ventasSemana: ventasSemana.length,
            ingresosSemana,
            ingresosMes,
            crecimiento: Math.round(crecimiento * 100) / 100
        };
    },

    // Obtener top productos mÃ¡s vendidos
    getTopProducts: async (limit = 5, signal) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        let query = supabase
            .from('sale_items')
            .select('product_name, quantity, price, total');

        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data: saleItems, error } = await query;

        if (error) throw error;

        // Agrupar por producto y sumar
        const productosMap = {};
        saleItems.forEach(item => {
            const nombre = item.product_name;
            if (!productosMap[nombre]) {
                productosMap[nombre] = {
                    name: nombre,
                    cantidadVendida: 0,
                    ingresos: 0
                };
            }
            productosMap[nombre].cantidadVendida += item.quantity || 0;
            productosMap[nombre].ingresos += parseFloat(item.total) || 0;
        });

        // Convertir a array y ordenar por cantidad vendida
        const topProductos = Object.values(productosMap)
            .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
            .slice(0, limit)
            .map((prod, index) => ({
                id: index + 1,
                name: prod.name,
                cantidadVendida: prod.cantidadVendida,
                ingresos: prod.ingresos
            }));

        return topProductos;
    },

    // Obtener ventas por dÃ­a de la semana actual
    getWeeklySalesData: async (signal) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [0, 0, 0, 0, 0, 0, 0];

        const ahora = new Date();

        // Calcular inicio de la semana (Lunes)
        const diaActual = ahora.getDay();
        const diasHastaLunes = diaActual === 0 ? 6 : diaActual - 1;
        const inicioSemana = new Date(ahora);
        inicioSemana.setDate(ahora.getDate() - diasHastaLunes);
        inicioSemana.setHours(0, 0, 0, 0);

        // Obtener ventas de la semana
        let query = supabase
            .from('sales')
            .select('total, created_at')
            .gte('created_at', inicioSemana.toISOString());

        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data: ventas, error } = await query;

        if (error) throw error;

        // Agrupar ventas por dÃ­a de la semana (0 = Lunes, 6 = Domingo)
        const ventasPorDia = [0, 0, 0, 0, 0, 0, 0]; // Lun, Mar, Mie, Jue, Vie, Sab, Dom

        ventas.forEach(venta => {
            const fechaVenta = new Date(venta.created_at);
            const diaSemana = fechaVenta.getDay();
            // Convertir: Domingo(0) -> 6, Lunes(1) -> 0, etc.
            const indice = diaSemana === 0 ? 6 : diaSemana - 1;
            ventasPorDia[indice] += parseFloat(venta.total) || 0;
        });

        return ventasPorDia;
    },

    // Obtener estadÃ­sticas por rango de fechas
    getStatisticsByDateRange: async (fechaInicio, fechaFin, signal) => {
        let query = supabase
            .from('sales')
            .select('total, created_at');

        if (fechaInicio) {
            query = query.gte('created_at', fechaInicio);
        }
        if (fechaFin) {
            // Agregar tiempo al final del dÃ­a
            const fechaFinCompleta = new Date(fechaFin);
            fechaFinCompleta.setHours(23, 59, 59, 999);
            query = query.lte('created_at', fechaFinCompleta.toISOString());
        }

        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data: ventas, error } = await query;

        if (error) throw error;

        const ventasEnRango = ventas.length;
        const ingresosEnRango = ventas.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);

        return {
            ventasEnRango,
            ingresosEnRango,
            fechaInicio: fechaInicio || 'Sin lÃ­mite inicial',
            fechaFin: fechaFin || 'Sin lÃ­mite final'
        };
    },

    // Eliminar una venta (requiere permisos administrativos)
    deleteSale: async (saleId) => {
        const { error: itemsError } = await supabase
            .from('sale_items')
            .delete()
            .eq('sale_id', saleId);

        if (itemsError) throw itemsError;

        const { error: saleError } = await supabase
            .from('sales')
            .delete()
            .eq('id', saleId);

        if (saleError) throw saleError;
        return true;
    }
};

