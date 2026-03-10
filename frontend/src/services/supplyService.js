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

        // 1. Obtener stock actual
        const { data: supply, error: getError } = await supabase
            .from('supplies')
            .select('current_stock')
            .eq('id', entryData.supply_id)
            .single();

        if (getError) throw getError;

        // 2. Actualizar stock
        const newStock = parseFloat(supply.current_stock || 0) + parseFloat(entryData.quantity);
        const { data, error } = await supabase
            .from('supplies')
            .update({ current_stock: newStock })
            .eq('id', entryData.supply_id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Registrar uso (Libreta Digital)
    recordUsage: async (usageData) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No hay una sesión activa.");

        // 1. Obtener stock actual
        const { data: supply, error: getError } = await supabase
            .from('supplies')
            .select('current_stock')
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
                results.push({ name: data.name, diff: diff });
            }
        }

        return { success: true, summary: results };
    },

    // Historial (Simulado por ahora o consultando tabla de logs si existiera)
    getReconciliationHistory: async () => {
        // En una fase 2 agregaremos una tabla 'supply_logs' para este historial real
        return [];
    },
};
