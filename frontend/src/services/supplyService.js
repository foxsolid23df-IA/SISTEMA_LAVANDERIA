import { supabase } from '../supabase';

export const supplyService = {
    // Obtener todos los insumos (exclusivos para el usuario logueado en WEB y NUBE)
    getAll: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('supplies')
            .select('*')
            .eq('user_id', user.id)
            .not('is_active', 'eq', false) // Use .not to handle cases where is_active is null before migration is complete
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    // Crear nuevo insumo (vinculado a user_id)
    create: async (supplyData) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No hay una sesión activa para crear insumos.");

        const { data, error } = await supabase
            .from('supplies')
            .insert([{
                name: supplyData.name,
                unit_measure: supplyData.unit_measure,
                presentation: supplyData.presentation || 'Galón',
                content_per_presentation: parseFloat(supplyData.content_per_presentation || 1),
                min_stock: parseFloat(supplyData.min_stock || 0),
                current_stock: 0,
                is_fractional: supplyData.is_fractional || false,
                user_id: user.id
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Actualizar nombre, unidad y min_stock
    update: async (id, supplyData) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No hay una sesión activa para actualizar insumos.");

        const { data, error } = await supabase
            .from('supplies')
            .update({
                name: supplyData.name,
                unit_measure: supplyData.unit_measure,
                presentation: supplyData.presentation || 'Galón',
                content_per_presentation: parseFloat(supplyData.content_per_presentation || 1),
                min_stock: parseFloat(supplyData.min_stock || 0),
                current_stock: parseFloat(supplyData.current_stock || 0),
                is_fractional: supplyData.is_fractional || false
            })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Borrado suave
    delete: async (id) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No hay una sesión activa para borrar insumos.");

        // Realizar un borrado suave actualizando is_active a false
        const { data, error } = await supabase
            .from('supplies')
            .update({ is_active: false })
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;
        return true;
    },

    // Registrar entrada (vinculado a user_id)
    addWeekly: async (entryData) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No hay una sesión activa.");

        // 1. Obtener stock actual Y factor de conversión
        const { data: supply, error: getError } = await supabase
            .from('supplies')
            .select('current_stock, content_per_presentation')
            .eq('id', entryData.supply_id)
            .eq('user_id', user.id)
            .single();

        if (getError) throw getError;

        // 2. Calcular cantidad real en unidad base
        // Ej: El usuario pone "2 Galones" * 3.7 L/Galón = 7.4 L
        const factor = parseFloat(supply.content_per_presentation || 1);
        const qtyPresentations = parseFloat(entryData.quantity);
        const realQuantity = qtyPresentations * factor;

        // 3. Actualizar stock (sumando en unidad base)
        const newStock = Math.round((parseFloat(supply.current_stock || 0) + realQuantity) * 10000) / 10000;
        const { data, error } = await supabase
            .from('supplies')
            .update({ current_stock: newStock })
            .eq('id', entryData.supply_id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;

        // 4. REGISTRAR MOVIMIENTO con ambos datos
        const { error: moveError } = await supabase
            .from('supply_movements')
            .insert([{
                user_id: user.id,
                supply_id: entryData.supply_id,
                type: 'ENTRY_WEEKLY',
                quantity: realQuantity,
                notes: entryData.notes
                    ? `${qtyPresentations} presentación(es) × ${factor} = ${realQuantity.toFixed(2)} | ${entryData.notes}`
                    : `${qtyPresentations} presentación(es) × ${factor} = ${realQuantity.toFixed(2)}`,
                staff_name: 'Administrador',
                usage_date: new Date().toISOString().split('T')[0]
            }]);

        if (moveError) {
            console.error("Error al registrar movimiento:", moveError);
            // No lanzamos error fatal para no revertir el stock si ya se actualizó, 
            // pero informamos en consola.
        }

        return data;
    },

    // Registrar uso (Libreta Digital)
    recordUsage: async (usageData) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No hay una sesión activa.");

        // 1. Obtener stock actual, unidad de medida y configuración fraccional
        const { data: supply, error: getError } = await supabase
            .from('supplies')
            .select('current_stock, unit_measure, is_fractional, content_per_presentation, presentation')
            .eq('id', usageData.supply_id)
            .single();

        if (getError) throw getError;

        // 2. Calcular cantidad real a descontar
        let realQuantity = parseFloat(usageData.quantity);
        let fractionLabel = '';

        if (supply.is_fractional && usageData.is_fraction) {
            // Convertir fracción visual → gramos reales
            // Ej: fracción=0.25, content_per_presentation=2000 → realQuantity=500g
            const fraction = parseFloat(usageData.quantity);
            const weightPerRoll = parseFloat(supply.content_per_presentation || 1000);
            realQuantity = fraction * weightPerRoll;

            // Etiqueta legible para la nota
            const fractionMap = { '0.25': '1/4', '0.5': '1/2', '0.75': '3/4', '1': '1 entero' };
            fractionLabel = fractionMap[String(fraction)] || `${fraction}`;
        }

        // 3. Calcular nuevo stock
        const newStock = Math.round((parseFloat(supply.current_stock || 0) - realQuantity) * 10000) / 10000;

        // 4. Actualizar stock
        const { data, error } = await supabase
            .from('supplies')
            .update({ current_stock: Math.max(0, newStock) })
            .eq('id', usageData.supply_id)
            .select()
            .single();

        if (error) throw error;

        // 5. REGISTRAR MOVIMIENTO en supply_movements
        const cleanUnit = supply.unit_measure ? supply.unit_measure.replace(/^\d+\s*/, '') : '';

        // Nota descriptiva según tipo de insumo
        let baseNote;
        if (supply.is_fractional && usageData.is_fraction) {
            baseNote = `${fractionLabel} de ${supply.presentation || 'Rollo'} = ${realQuantity.toFixed(2)} ${cleanUnit}`;
        } else {
            baseNote = `${realQuantity} ${cleanUnit}`;
        }
        const finalNote = usageData.notes ? `${baseNote} | ${usageData.notes}` : baseNote;

        await supabase
            .from('supply_movements')
            .insert([{
                user_id: user.id,
                supply_id: usageData.supply_id,
                type: usageData.type,  // USAGE_MORNING o USAGE_AFTERNOON
                quantity: realQuantity,
                notes: finalNote,
                staff_name: usageData.user_name || 'Desconocido',
                usage_date: usageData.usage_date || new Date().toISOString().split('T')[0]
            }]);

        return data;
    },

    // Reconciliación / Corte (Cerrar semana)
    closeWeek: async (reconData) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No hay una sesión activa.");

        const results = [];
        for (const item of reconData.reconciliations) {
            // Actualizar stock de cada insumo al valor físico real
            const { data, error } = await supabase
                .from('supplies')
                .update({ current_stock: parseFloat(item.physical_stock) })
                .eq('id', item.supply_id)
                .select('id, name, current_stock')
                .single();

            if (!error) {
                const diff = Math.round((parseFloat(item.previous_stock || 0) - parseFloat(item.physical_stock || 0)) * 10000) / 10000;
                
                // Si viene el último conteo en los datos, calcular el gasto real
                const lastCount = item.last_count !== undefined && item.last_count !== null 
                    ? parseFloat(item.last_count) 
                    : parseFloat(item.previous_stock || 0);
                const gasto = lastCount - parseFloat(item.physical_stock || 0);

                results.push({ name: data.name, diff: diff, gasto: gasto, last_count: lastCount, physical_stock: parseFloat(item.physical_stock || 0) });

                // Insert into reconciliation history
                await supabase
                    .from('supply_reconciliations')
                    .insert([{
                        user_id: user.id,
                        supply_id: item.supply_id,
                        responsible: reconData.responsible,
                        reconciliation_date: reconData.reconciliation_date,
                        theoretical_stock: parseFloat(item.previous_stock || 0),
                        physical_stock: parseFloat(item.physical_stock || 0),
                        difference: diff
                    }]);

                // Registrar la diferencia como comprobante formal de ajuste/consumo en los movimientos diarios
                if (diff !== 0) {
                    await supabase
                        .from('supply_movements')
                        .insert([{
                            user_id: user.id,
                            supply_id: item.supply_id,
                            type: 'ADJUSTMENT',
                            quantity: -diff, // Si el teórico era 10 y el físico 8, la diferencia (merma) es 2. El movimiento debe ser -2.
                            notes: `Descuento por Corte Semanal. (Sist: ${parseFloat(item.previous_stock || 0)} → Físico: ${parseFloat(item.physical_stock || 0)})`,
                            staff_name: reconData.responsible || 'Sistema',
                            usage_date: reconData.reconciliation_date || new Date().toISOString().split('T')[0]
                        }]);
                }
            }
        }

        return { success: true, summary: results };
    },

    // Obtener los últimos conteos físicos por insumo
    getLatestReconciliations: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('supply_reconciliations')
            .select('*')
            .eq('user_id', user.id)
            .order('reconciliation_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Agrupar para obtener solo el más reciente por insumo
        const latest = {};
        (data || []).forEach(record => {
            if (!latest[record.supply_id]) {
                latest[record.supply_id] = record;
            }
        });
        
        return Object.values(latest);
    },

    // Historial
    getReconciliationHistory: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('supply_reconciliations')
            .select(`
                *,
                supply:supplies(name, unit_measure)
            `)
            .eq('user_id', user.id)
            .order('reconciliation_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    // Historial de movimientos diarios (Entradas + Consumos)
    getMovementHistory: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('supply_movements')
            .select(`
                *,
                supply:supplies(name, unit_measure)
            `)
            .eq('user_id', user.id)
            .order('usage_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;
        return data || [];
    },

    // Generar tabla de Análisis Semanal
    getWeeklyTable: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data: supplies, error: supError } = await supabase
            .from('supplies')
            .select('*')
            .eq('user_id', user.id)
            .not('is_active', 'eq', false);

        if (supError) throw supError;

        const { data: recons, error: recError } = await supabase
            .from('supply_reconciliations')
            .select('*')
            .eq('user_id', user.id)
            .order('reconciliation_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (recError) throw recError;

        const latestRecons = {};
        (recons || []).forEach(record => {
            if (!latestRecons[record.supply_id]) {
                latestRecons[record.supply_id] = record;
            }
        });

        const { data: movements, error: movError } = await supabase
            .from('supply_movements')
            .select('*')
            .eq('user_id', user.id)
            .eq('type', 'ENTRY_WEEKLY')
            .order('usage_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (movError) throw movError;

        const latestEntries = {};
        (movements || []).forEach(record => {
            if (!latestEntries[record.supply_id]) {
                latestEntries[record.supply_id] = record;
            }
        });

        const table = supplies.map(supply => {
            const lastCostRecon = latestRecons[supply.id];
            const lastEntry = latestEntries[supply.id];

            const ultimoCorte = lastCostRecon ? parseFloat(lastCostRecon.physical_stock || 0) : 0;
            const ultimaCompra = lastEntry ? parseFloat(lastEntry.quantity || 0) : 0;
            const stockSistema = parseFloat(supply.current_stock || 0);

            const totalGastado = (ultimoCorte + ultimaCompra) - stockSistema;

            return {
                id: supply.id,
                Insumo: supply.name,
                "Ultimo Corte": ultimoCorte,
                "Ultima Compra": ultimaCompra,
                "Stock Sistema": stockSistema,
                "Total Gastado": `(${ultimoCorte.toFixed(2)} + ${ultimaCompra.toFixed(2)}) - ${stockSistema.toFixed(2)}`,
                "Total de la Semana": totalGastado
            };
        });

        return table;
    },

    // Obtener datos del periodo para el Nuevo Corte de Insumos
    getReconciliationPeriodData: async (startDate, endDate) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        // Llama a la funcion RPC 
        const { data, error } = await supabase.rpc('get_supplies_period_data', {
            p_user_id: user.id,
            p_start_date: startDate,
            p_end_date: endDate
        });

        if (error) throw error;
        return data || [];
    }
};
