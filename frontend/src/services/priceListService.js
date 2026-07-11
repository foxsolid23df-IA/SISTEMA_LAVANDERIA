import { supabase } from '../supabase';

export const priceListService = {
    async getPriceList(storeId) {
        const { data: categories, error: catError } = await supabase
            .from('service_categories')
            .select('id, name, sort_order')
            .eq('user_id', storeId)
            .order('sort_order', { ascending: true });

        if (catError) throw catError;
        if (!categories || categories.length === 0) {
            return { categories: [], items: [], settings: null };
        }

        const categoryIds = categories.map(c => c.id);

        const { data: items, error: itemError } = await supabase
            .from('service_items')
            .select('id, category_id, name, price, unit, sort_order, active')
            .in('category_id', categoryIds)
            .order('sort_order', { ascending: true });

        if (itemError) throw itemError;

        const { data: settings } = await supabase
            .from('store_delivery_settings')
            .select('*')
            .eq('user_id', storeId)
            .single();

        return {
            categories: categories || [],
            items: items || [],
            settings: settings || null,
        };
    },

    async saveCategories(storeId, categories) {
        const newCats = categories.filter(c => !c.id);
        const existingCats = categories.filter(c => c.id);

        if (newCats.length > 0) {
            const { error } = await supabase
                .from('service_categories')
                .insert(newCats.map(c => ({
                    user_id: storeId,
                    name: c.name,
                    sort_order: c.sort_order || 0,
                })));
            if (error) throw error;
        }

        for (const c of existingCats) {
            const { error } = await supabase
                .from('service_categories')
                .update({ name: c.name, sort_order: c.sort_order || 0 })
                .eq('id', c.id);
            if (error) throw error;
        }
    },

    async deleteCategory(categoryId) {
        const { error } = await supabase
            .from('service_categories')
            .delete()
            .eq('id', categoryId);
        if (error) throw error;
    },

    async saveItems(items) {
        const newItems = items.filter(i => !i.id);
        const existingItems = items.filter(i => i.id);

        if (newItems.length > 0) {
            const { error } = await supabase
                .from('service_items')
                .insert(newItems.map(i => ({
                    user_id: i.user_id,
                    category_id: i.category_id,
                    name: i.name,
                    price: i.price,
                    unit: i.unit || 'pieza',
                    sort_order: i.sort_order || 0,
                    active: i.active !== false,
                })));
            if (error) throw error;
        }

        for (const i of existingItems) {
            const { error } = await supabase
                .from('service_items')
                .update({
                    category_id: i.category_id,
                    name: i.name,
                    price: i.price,
                    unit: i.unit || 'pieza',
                    sort_order: i.sort_order || 0,
                    active: i.active !== false,
                })
                .eq('id', i.id);
            if (error) throw error;
        }
    },

    async deleteItem(itemId) {
        const { error } = await supabase
            .from('service_items')
            .delete()
            .eq('id', itemId);
        if (error) throw error;
    },

    async getDeliverySettings(storeId) {
        const { data, error } = await supabase
            .from('store_delivery_settings')
            .select('*')
            .eq('user_id', storeId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data || {
            user_id: storeId,
            min_free_delivery: 250,
            small_order_fee: 35,
            auto_reminder_enabled: true,
            reminder_minutes: 30,
            currency: 'MXN',
            price_list_image_url: null,
        };
    },

    async saveDeliverySettings(storeId, settings) {
        const { error } = await supabase
            .from('store_delivery_settings')
            .upsert({
                user_id: storeId,
                min_free_delivery: settings.min_free_delivery || 250,
                small_order_fee: settings.small_order_fee || 35,
                auto_reminder_enabled: settings.auto_reminder_enabled !== false,
                reminder_minutes: settings.reminder_minutes || 30,
                currency: settings.currency || 'MXN',
                price_list_image_url: settings.price_list_image_url || null,
            }, { onConflict: 'user_id' });
        if (error) throw error;
    },
};
