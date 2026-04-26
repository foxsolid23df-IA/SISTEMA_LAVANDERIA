import { supabase } from '../supabase';

export const exchangeRateService = {
    // Obtener todos los tipos de cambio más recientes (activos o no) para USD, EUR, CAD
    getAllCurrencies: async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            // Fetch the latest entry for each currency
            const currencies = ['USD', 'EUR', 'CAD'];
            const results = [];
            
            for (const currency of currencies) {
                const { data, error } = await supabase
                    .from('exchange_rates')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('currency_code', currency)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                
                if (data) {
                    results.push(data);
                } else {
                    // Default if not exists
                    results.push({ currency_code: currency, rate: 0, is_active: false });
                }
            }
            return results;
        } catch (error) {
            console.error('[exchangeRateService] Error in getAllCurrencies:', error);
            return [];
        }
    },

    // Obtener solo las monedas activas
    getActiveRates: async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const currencies = ['USD', 'EUR', 'CAD'];
            const activeResults = [];

            for (const currency of currencies) {
                const { data } = await supabase
                    .from('exchange_rates')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('currency_code', currency)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                
                if (data) {
                    activeResults.push(data);
                }
            }
            return activeResults;
        } catch (error) {
            console.error('[exchangeRateService] Error in getActiveRates:', error);
            return [];
        }
    },

    // Backward compatibility for old USD method (to avoid breaking other parts immediately if any)
    getActiveRate: async () => {
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            if (authError) {
                if (authError.message?.includes('aborted') || authError.name === 'AbortError') return null;
                console.error('[exchangeRateService] Auth error:', authError);
                return null;
            }
            if (!user) return null;

            const { data, error } = await supabase
                .from('exchange_rates')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .eq('currency_code', 'USD')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('[exchangeRateService] Error fetching exchange rate:', error);
                return null;
            }
            return data;
        } catch (error) {
            if (error?.message?.includes('aborted') || error?.name === 'AbortError') return null;
            console.error('[exchangeRateService] Error in getActiveRate:', error);
            return null;
        }
    },

    // Actualizar o crear nuevo tipo de cambio para una moneda específica
    updateCurrencyRate: async (currencyCode, rate, isActive) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');

        // Desactivar el anterior para esta moneda
        await supabase
            .from('exchange_rates')
            .update({ is_active: false })
            .eq('user_id', user.id)
            .eq('currency_code', currencyCode);

        // Insertar nuevo rate
        const { data, error } = await supabase
            .from('exchange_rates')
            .insert([{
                user_id: user.id,
                rate: rate,
                currency_code: currencyCode,
                is_active: isActive
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Mantener esto para compatibilidad si se usa
    updateRate: async (rate) => {
        return exchangeRateService.updateCurrencyRate('USD', rate, true);
    },

    // Activar/Desactivar moneda
    toggleCurrencyActive: async (currencyCode, isActive) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: currentRate } = await supabase
            .from('exchange_rates')
            .select('*')
            .eq('user_id', user.id)
            .eq('currency_code', currencyCode)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (currentRate) {
            const { error } = await supabase
                .from('exchange_rates')
                .update({ is_active: isActive })
                .eq('id', currentRate.id);
            if (error) throw error;
        } else if (isActive) {
            await exchangeRateService.updateCurrencyRate(currencyCode, 0, true);
        }
    },

    toggleActive: async (isActive) => {
        return exchangeRateService.toggleCurrencyActive('USD', isActive);
    }
};
