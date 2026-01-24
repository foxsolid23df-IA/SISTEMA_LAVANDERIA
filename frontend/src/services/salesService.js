import { supabase } from '../supabase';
import { terminalService } from './terminalService';

export const salesService = {
    // Crear una nueva venta
    createSale: async (saleData) => {
        const { data: userData } = await supabase.auth.getUser();
        const terminalId = terminalService.getTerminalId();

        if (!terminalId) {
            throw new Error("Terminal no configurada. No se puede realizar la venta.");
        }

        // 1. Crear la venta principal
        const { data: sale, error: saleError } = await supabase
            .from('sales')
            .insert([{
                total: saleData.total,
                user_id: userData.user.id,
                currency: saleData.currency || 'MXN',
                exchange_rate: saleData.exchange_rate || null,
                amount_usd: saleData.amount_usd || null,
                payment_method: saleData.metodoPago || 'efectivo',
                terminal_id: terminalId
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
            user_id: userData.user.id
        }));

        const { error: itemsError } = await supabase
            .from('sale_items')
            .insert(saleItems);

        if (itemsError) throw itemsError;

        // 3. Actualizar stock de productos (Atomic RPC w/ Concurrency Check)
        const itemsForStockUpdate = saleData.items.map(item => ({
            id: item.id,
            quantity: item.quantity
        }));

        const { error: stockError } = await supabase
            .rpc('decrement_stock', { items: itemsForStockUpdate });

        if (stockError) {
            console.error('Error actualizando stock (RPC):', stockError);
            // Idealmente aquí deberíamos revertir la venta o notificar al admin
            // Por ahora mantenemos el comportamiento de logging pero el error es más informativo
            // throw stockError; // Descomentar si queremos fallar la transacción completa (pero la venta ya se creó)
        }

        return sale;
    },

    // Obtener ventas de hoy
    getTodaySales: async () => {
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

    // Obtener ventas desde una fecha (con items)
    getSalesSince: async (startTime, terminalId = null) => {
        // Validación de UUID para terminalId
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
            console.warn('getSalesSince: terminalId provisto no es un UUID válido:', terminalId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    },

    // Obtener todas las ventas (con paginación)
    getSales: async (limit = 50) => {
        const { data, error } = await supabase
            .from('sales')
            .select(`
                *,
                sale_items (*)
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

    // Obtener estadísticas generales
    getStatistics: async (signal) => {
        const ahora = new Date();

        // Día actual
        const inicioDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        const finDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);

        // Semana actual (desde el lunes)
        const diaActual = ahora.getDay();
        const diasHastaLunes = diaActual === 0 ? 6 : diaActual - 1;
        const inicioSemana = new Date(ahora);
        inicioSemana.setDate(ahora.getDate() - diasHastaLunes);
        inicioSemana.setHours(0, 0, 0, 0);

        // Mes actual y anterior
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
        const finMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59, 999);

        console.log('[salesService] Consultando ventas desde Supabase...')

        // Obtener todas las ventas para cálculos (Limitado a las últimas 2000 para evitar bloqueos)
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

        // Calcular estadísticas
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

    // Obtener top productos más vendidos
    getTopProducts: async (limit = 5, signal) => {
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

    // Obtener ventas por día de la semana actual
    getWeeklySalesData: async (signal) => {
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

        // Agrupar ventas por día de la semana (0 = Lunes, 6 = Domingo)
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

    // Obtener estadísticas por rango de fechas
    getStatisticsByDateRange: async (fechaInicio, fechaFin, signal) => {
        let query = supabase
            .from('sales')
            .select('total, created_at');

        if (fechaInicio) {
            query = query.gte('created_at', fechaInicio);
        }
        if (fechaFin) {
            // Agregar tiempo al final del día
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
            fechaInicio: fechaInicio || 'Sin límite inicial',
            fechaFin: fechaFin || 'Sin límite final'
        };
    }
};
