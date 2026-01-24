import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { productService } from '../services/productService';
import { supabase } from '../supabase';

const ProductContext = createContext();

export const useProducts = () => {
    const context = useContext(ProductContext);
    if (!context) {
        throw new Error('useProducts must be used within a ProductProvider');
    }
    return context;
};

// Alias para compatibilidad mientras se limpia el código
export const useProductsContext = useProducts;

// Alias ya definido arriba

export const ProductProvider = ({ children }) => {
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Referencia para saber si el componente sigue montado (para evitar errores de React)
    const isMounted = useRef(true);

    // Flag para evitar múltiples cargas iniciales simultáneas
    const isFetching = useRef(false);

    // Función para cargar productos - CON REINTENTO AUTOMÁTICO
    const loadProducts = useCallback(async (forceRefresh = false, retryCount = 0) => {
        if (!isMounted.current || isFetching.current) return;
        
        isFetching.current = true;
        setLoading(true);
        setError(null);

        try {
            console.log(`[ProductContext] Iniciando carga (Intento ${retryCount + 1})...`, { forceRefresh });
            const data = await productService.getProducts({ forceRefresh });
            
            if (isMounted.current) {
                const safeProds = Array.isArray(data) ? data : [];
                console.log('[ProductContext] Productos cargados exitosamente:', safeProds.length);
                setProductos(safeProds);
                setLoading(false);
            }
        } catch (err) {
            console.error(`[ProductContext] Error cargando productos (Intento ${retryCount + 1}):`, err);
            
            const isAbort = err?.message?.includes('aborted') || err?.name === 'AbortError';
            
            // Si falló (incluso por abort), y es el primer intento, reintentamos automáticamente
            if (isMounted.current && retryCount < 2) {
                console.log(`[ProductContext] Reintentando carga en 1s...`);
                setTimeout(() => {
                    if (isMounted.current) {
                        isFetching.current = false;
                        loadProducts(forceRefresh, retryCount + 1);
                    }
                }, 1000); // Esperar 1 segundo antes de reintentar
                return; // Salimos para no setear error todavía
            }

            if (isMounted.current && !isAbort) {
                setError('No se pudieron cargar los productos. Intenta recargar.');
                setLoading(false); 
            }
        } finally {
            isFetching.current = false;
        }
    }, []); // Ya no depende de productos.length
    
    // Función para actualizar un producto específico (útil para realtime)
    const updateProduct = useCallback((updatedProduct) => {
        setProductos(prev => {
            if (!Array.isArray(prev)) return [updatedProduct];
            // Encontrar si el producto existe antes de mapear para ser más eficiente
            const exists = prev.some(p => p.id === updatedProduct.id);
            if (!exists) {
                // Si no existe (tal vez se cargó mientras se agregaba), lo agregamos
                return [updatedProduct, ...prev];
            }
            return prev.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p);
        });
    }, []);

    // Función para agregar un producto
    const addProduct = useCallback((newProduct) => {
        setProductos(prev => {
            if (!Array.isArray(prev)) return [newProduct];
            if (prev.some(p => p.id === newProduct.id)) return prev;
            return [newProduct, ...prev];
        });
    }, []);

    // Función para eliminar un producto
    const removeProduct = useCallback((productId) => {
        setProductos(prev => {
            if (!Array.isArray(prev)) return [];
            return prev.filter(p => p.id !== productId);
        });
    }, []);

    // Consolidar carga inicial y suscripción a cambios en tiempo real
    useEffect(() => {
        isMounted.current = true;
        
        // Carga inicial
        loadProducts();

        // Suscripción a cambios en tiempo real (Multi-caja)
        console.log('[ProductContext] Estableciendo suscripción Realtime...');
        const subscription = productService.subscribeToProducts((payload) => {
            if (!isMounted.current) return;

            const { eventType, new: newRecord, old: oldRecord } = payload;
            console.log(`[ProductContext] Realtime Event: ${eventType}`, payload);

            try {
                switch (eventType) {
                    case 'INSERT':
                        addProduct(newRecord);
                        break;
                    case 'UPDATE':
                        updateProduct(newRecord);
                        break;
                    case 'DELETE':
                        removeProduct(oldRecord.id);
                        break;
                    default:
                        console.warn('[ProductContext] Evento no manejado:', eventType);
                }
            } catch (err) {
                console.error('[ProductContext] Error procesando evento realtime:', err);
            }
        });

        return () => {
            console.log('[ProductContext] Limpiando suscripción y marcando como desmontado');
            isMounted.current = false;
            if (subscription) {
                supabase.removeChannel(subscription);
            }
        };
    }, []); // Dependencias vacías para asegurar que solo se ejecute UNA VEZ al montar

    const value = {
        productos,
        loading,
        error,
        loadProducts,
        updateProduct,
        addProduct,
        removeProduct,
    };

    return (
        <ProductContext.Provider value={value}>
            {children}
        </ProductContext.Provider>
    );
};
