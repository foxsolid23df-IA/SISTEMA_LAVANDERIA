import { supabase } from '../supabase';
import { isAbortError } from '../utils/supabaseErrorHandler';
import { config } from '../config';

const LOCAL_API_URL = config.api.baseUrl + '/api/products';

// Variables de cachÃ© en memoria (Desactivadas temporalmente para asegurar sincronizaciÃ³n multicaja)
let productsCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 0; // 0 para forzar siempre carga desde DB en multicaja

export const productService = {
    // Helper para actualizar el cachÃ© localmente (Ãºtil para realtime)
    updateCache: (updatedProduct, type = 'UPDATE') => {
        if (!productsCache) return;

        if (type === 'INSERT') {
            // Verificar si ya existe para evitar duplicados
            if (!productsCache.some(p => p.id === updatedProduct.id)) {
                productsCache = [updatedProduct, ...productsCache];
            }
        } else if (type === 'DELETE') {
            productsCache = productsCache.filter(p => p.id !== updatedProduct.id);
        } else {
            // UPDATE
            productsCache = productsCache.map(p =>
                p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p
            );
        }
    },

    // Suscribirse a cambios en productos en tiempo real
    subscribeToProducts: (callback) => {
        return supabase
            .channel('public:products')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'products'
            }, (payload) => {
                console.log('[ProductService] Cambio detectado:', payload.eventType);
                // Actualizar cachÃ© local segÃºn el tipo de evento
                productService.updateCache(payload.new || payload.old, payload.eventType);
                // Notificar al componente/contexto
                callback(payload);
            })
            .subscribe();
    },

    // Obtener todos los productos (con cachÃ© y fallback local)
    getProducts: async ({ forceRefresh = false } = {}) => {
        const now = Date.now();

        // 1. Si hay cachÃ© vÃ¡lido y no se fuerza refresco
        if (!forceRefresh && productsCache && (now - lastFetchTime < CACHE_DURATION)) {
            return [...productsCache];
        }

        let currentUserId = null;
        try {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (!userError && userData?.user) {
                currentUserId = userData.user.id;
            } else {
                console.warn('[ProductService] No se pudo obtener el usuario para filtrar productos:', userError?.message);
            }
        } catch (authError) {
            console.warn('[ProductService] Error de autenticaciÃ³n al intentar cargar productos:', authError.message);
        }

        // 3. Intentar Supabase (Nube) - Solo si tenemos usuario
        if (currentUserId) {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .eq('user_id', currentUserId)
                    .order('name', { ascending: true });

                if (!error && Array.isArray(data)) {
                    productsCache = data;
                    lastFetchTime = now;
                    return data;
                }
                
                if (error) console.warn('[ProductService] Error en Supabase, intentando local...', error.message);
            } catch (error) {
                console.warn('[ProductService] Fallo de conexiÃ³n a Supabase, intentando local...');
            }
        }

        if (config.isAndroid) {
            console.warn('[ProductService] Android APK requiere Supabase en linea; se omite fallback local.');
            return productsCache || [];
        }

        // 4. Fallback: Intentar API Local (SQLite)
        // Intentamos local si no hay usuario (offline) o si fallÃ³ Supabase
        try {
            const response = await fetch(LOCAL_API_URL).catch(() => null);
            if (response && response.ok) {
                const localData = await response.json();
                // Normalizar datos de SQLite a formato Supabase si es necesario
                const rawList = Array.isArray(localData) ? localData : (localData.productos || []);
                const normalized = rawList.map(p => ({
                    ...p,
                    image_url: p.image_url || p.image // Mapear image de SQLite a image_url
                }));
                
                if (normalized.length > 0) {
                    productsCache = normalized;
                    lastFetchTime = now;
                    return normalized;
                }
            }
        } catch (localError) {
            console.error('[ProductService] Error crÃ­tico: Ni Supabase ni API Local responden correctamente.', localError);
        }

        // 5. Ãšltima opciÃ³n: Retornar cachÃ© anterior o array vacÃ­o
        return productsCache || [];
    },

    /**
     * Sincroniza el inventario de Supabase hacia la base de datos local (SQLite)
     */
    syncWithLocal: async () => {
        try {
            // 1. Obtener el usuario actual
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error("No hay una sesiÃ³n activa para sincronizar.");

            // 2. Obtener datos frescos de la nube FILTRADOS por user_id
            const { data: cloudProducts, error } = await supabase
                .from('products')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;

            // 3. Enviar al backend local para persistencia con PIN por URL
            const response = await fetch(`${config.api.baseUrl}/api/admin/sync/products?masterPin=2026SOP`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ products: cloudProducts })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[ProductService] Detalle del error de sincronizaciÃ³n:', errorData);
                throw new Error(errorData.error || 'Error al guardar en base de datos local');
            }

            const result = await response.json();
            return { success: true, ...result.result };
        } catch (error) {
            console.error('[ProductService] Error en sincronizaciÃ³n:', error);
            throw error;
        }
    },

    // Crear un nuevo producto
    createProduct: async (product) => {
        const { data: userData, error: authError } = await supabase.auth.getUser();

        if (authError) {
            if (authError.message?.includes('aborted') || authError.name === 'AbortError') {
                throw new Error('OperaciÃ³n cancelada');
            }
            throw authError;
        }
        const insertData = {
            name: product.name,
            price: parseFloat(product.price),
            cost_price: parseFloat(product.cost_price || 0),
            wholesale_price: parseFloat(product.wholesale_price || 0),
            stock: parseInt(product.stock),
            min_stock: parseInt(product.min_stock || 0),
            barcode: product.barcode || null,
            image_url: product.image || null,
            unit_type: product.unit_type || (product.pricing_type === 'kg' ? 'kg' : 'PZA'),
            pricing_type: product.pricing_type || (product.unit_type === 'kg' ? 'kg' : 'unit'),
            type: product.type || 'PRODUCT',
            merma: parseInt(product.merma || 0),
            user_id: userData.user.id
        };

        // Agregar categorÃ­a si existe (puede no estar en el esquema de BD, pero lo intentamos)
        if (product.category) {
            insertData.category = product.category;
        }

        const { data, error } = await supabase
            .from('products')
            .insert([insertData])
            .select()
            .single();

        if (error) throw error;

        // Actualizar cachÃ© local
        productService.updateCache(data, 'INSERT');

        return data;
    },

    // Actualizar un producto existente
    updateProduct: async (id, updates) => {
        const dbUpdates = {};
        
        // Solo agregar al objeto de actualizaciÃ³n los campos que vienen en 'updates'
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.price !== undefined) dbUpdates.price = parseFloat(updates.price);
        if (updates.cost_price !== undefined) dbUpdates.cost_price = parseFloat(updates.cost_price);
        if (updates.wholesale_price !== undefined) dbUpdates.wholesale_price = parseFloat(updates.wholesale_price);
        if (updates.stock !== undefined) dbUpdates.stock = parseInt(updates.stock);
        if (updates.min_stock !== undefined) dbUpdates.min_stock = parseInt(updates.min_stock);
        if (updates.barcode !== undefined) dbUpdates.barcode = updates.barcode;
        if (updates.image !== undefined) dbUpdates.image_url = updates.image;
        if (updates.image_url !== undefined) dbUpdates.image_url = updates.image_url;
        if (updates.category !== undefined) dbUpdates.category = updates.category;
        if (updates.unit_type !== undefined) dbUpdates.unit_type = updates.unit_type;
        if (updates.pricing_type !== undefined) dbUpdates.pricing_type = updates.pricing_type;
        if (updates.type !== undefined) dbUpdates.type = updates.type;
        if (updates.merma !== undefined) dbUpdates.merma = parseInt(updates.merma);

        const { data, error } = await supabase
            .from('products')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Actualizar cachÃ© local
        productService.updateCache(data, 'UPDATE');

        return data;
    },

    // Eliminar un producto
    deleteProduct: async (id) => {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Actualizar cachÃ© local
        productService.updateCache({ id }, 'DELETE');
    },

    // Buscar producto por cÃ³digo de barras
    getProductByBarcode: async (barcode) => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('barcode', barcode)
            .maybeSingle(); // Retorna null si no encuentra, en lugar de error

        if (error) throw error;
        return data;
    },

    // Obtener productos con poco stock (menos de 10 unidades)
    getLowStockProducts: async (threshold = 10, signal) => {
        let query = supabase
            .from('products')
            .select('*')
            .lte('stock', threshold)
            .order('stock', { ascending: true });

        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    },

    // Crear mÃºltiples productos (Carga Masiva)
    bulkCreateProducts: async (products) => {
        const { data: userData, error: authError } = await supabase.auth.getUser();

        if (authError) {
            if (authError.message?.includes('aborted') || authError.name === 'AbortError') {
                throw new Error('OperaciÃ³n cancelada');
            }
            throw authError;
        }

        const productsToInsert = products.map(product => ({
            name: product.name,
            price: parseFloat(product.price),
            cost_price: parseFloat(product.cost_price || 0),
            wholesale_price: parseFloat(product.wholesale_price || 0),
            stock: parseInt(product.stock),
            min_stock: parseInt(product.min_stock || 0),
            barcode: product.barcode || null,
            image_url: product.image || null,
            category: product.category || null,
            unit_type: product.unit_type || (product.pricing_type === 'kg' ? 'kg' : 'PZA'),
            pricing_type: product.pricing_type || (product.unit_type === 'kg' ? 'kg' : 'unit'),
            type: product.type || 'PRODUCT',
            user_id: userData.user.id
        }));

        const { data, error } = await supabase
            .from('products')
            .insert(productsToInsert)
            .select();

        if (error) throw error;

        // Invalidar cachÃ©
        productsCache = null;

        return data;
    }
};



