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
                current_stock: parseFloat(supplyData.current_stock || 0)
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
            .single();

        if (getError) throw getError;

        // 2. Calcular cantidad real en unidad base
        // Ej: El usuario pone "2 Galones" * 3.7 L/Galón = 7.4 L
        const factor = parseFloat(supply.content_per_presentation || 1);
        const qtyPresentations = parseFloat(entryData.quantity);
        const realQuantity = qtyPresentations * factor;

        // 3. Actualizar stock (sumando en unidad base)
        const newStock = parseFloat(supply.current_stock || 0) + realQuantity;
        const { data, error } = await supabase
            .from('supplies')
            .update({ current_stock: newStock })
            .eq('id', entryData.supply_id)
            .select()
            .single();

        if (error) throw error;

        // 4. REGISTRAR MOVIMIENTO con ambos datos
        await supabase
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

        return data;
    },

    // Registrar uso (Libreta Digital)
    recordUsage: async (usageData) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No hay una sesión activa.");

        // 1. Obtener stock actual y unidad de medida
        const { data: supply, error: getError } = await supabase
            .from('supplies')
            .select('current_stock, unit_measure')
            .eq('id', usageData.supply_id)
            .single();

        if (getError) throw getError;

        // 2. Calcular nuevo stock
        const newStock = parseFloat(supply.current_stock || 0) - parseFloat(usageData.quantity);

        // 3. Actualizar
        const { data, error } = await supabase
            .from('supplies')
            .update({ current_stock: Math.max(0, newStock) })
            .eq('id', usageData.supply_id)
            .select()
            .single();

        if (error) throw error;

        // 4. REGISTRAR MOVIMIENTO en supply_movements (FIX: antes se omitía)
        const qty = parseFloat(usageData.quantity);
        const cleanUnit = supply.unit_measure ? supply.unit_measure.replace(/^\d+\s*/, '') : '';
        const baseNote = `${qty} ${cleanUnit}`;
        const finalNote = usageData.notes ? `${baseNote} | ${usageData.notes}` : baseNote;

        await supabase
            .from('supply_movements')
            .insert([{
                user_id: user.id,
                supply_id: usageData.supply_id,
                type: usageData.type,  // USAGE_MORNING o USAGE_AFTERNOON
                quantity: qty,
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
                const diff = parseFloat(item.previous_stock || 0) - parseFloat(item.physical_stock || 0);
                
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
};
