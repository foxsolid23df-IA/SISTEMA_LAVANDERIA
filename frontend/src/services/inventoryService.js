import { supabase } from '../supabase';

export const inventoryService = {
    /**
     * @param {Object} params
     * @param {number} params.productId - ID del producto afectado (bigint -> number)
     * @param {string} params.type - 'IN' | 'OUT' | 'SALE'
     * @param {number} params.quantity - Cantidad de la entrada o salida
     * @param {number} params.unitCost - Costo unitario al registrar
     * @param {number} params.unitPrice - Precio de venta al registrar
     * @param {string} params.notes - Notas opcionales
     * @param {string} params.staffName - Nombre del staff que realiza la operación
     * @returns {Promise<Object>} Resultado con el success y nuevo stock
     */
    registerMovement: async ({ productId, type, quantity, unitCost, unitPrice, notes, staffName }) => {
        // Validación de datos
        if (!productId || !type || quantity <= 0) {
            throw new Error("Datos inválidos para registrar el movimiento.");
        }

        const payload = {
            p_product_id: parseInt(productId, 10),
            p_type: type,
            p_quantity: parseInt(quantity, 10),
            p_unit_cost: parseFloat(unitCost) || 0,
            p_unit_price: parseFloat(unitPrice) || 0,
            p_notes: notes || '',
            p_staff_name: staffName || ''
        };

        const { data, error } = await supabase.rpc('register_inventory_movement', payload);

        if (error) {
            console.error("[InventoryService] Error al registrar movimiento:", error);
            throw new Error(error.message || "Error al actualizar el inventario.");
        }

        return data; // { success: true, product_id, old_stock, new_stock }
    },

    /**
     * Obtiene el historial de movimientos de un producto particular
     * @param {number} productId 
     * @returns {Promise<Array>} Lista de movimientos
     */
    getMovementHistory: async (productId) => {
        const { data, error } = await supabase
            .from('product_movements')
            .select(`
                id,
                type,
                quantity,
                previous_stock,
                new_stock,
                unit_cost,
                unit_price,
                notes,
                staff_name,
                created_at,
                product_id,
                user_id
            `)
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("[InventoryService] Error al obtener el historial de inventario:", error);
            throw new Error(error.message || "Error al cargar historial.");
        }

        return data;
    },

    /**
     * Obtiene los productos filtrados solo para el visualizador del Kardex.
     * En lugar de llamar a `productService`, podríamos tener un getter ligero si es necesario,
     * pero para la tabla podemos utilizar directamente la data del productService.
     * Si necesitas KPIs integrados, puedes traerlos aquí.
     */
    getProductsValuation: async () => {
        const { data: userAuth, error: authErr } = await supabase.auth.getUser();
        if (authErr || !userAuth?.user) throw new Error("No autenticado.");

        const { data, error } = await supabase
            .from('products')
            .select(`
                id,
                name,
                stock,
                price,
                cost_price,
                min_stock,
                barcode
            `)
            .eq('user_id', userAuth.user.id)
            .eq('type', 'PRODUCT')
            .order('name', { ascending: true });
        
        if (error) {
            console.error("[InventoryService] Error al obtener valorización:", error);
            throw error;
        }

        // Calcula totales
        let totalCostValue = 0;
        let totalPriceValue = 0;
        let lowStockCount = 0;

        const valuationData = data.map(product => {
            const costVal = (product.stock > 0) ? (product.stock * (product.cost_price || 0)) : 0;
            const priceVal = (product.stock > 0) ? (product.stock * (product.price || 0)) : 0;
            
            totalCostValue += costVal;
            totalPriceValue += priceVal;

            if (product.stock <= (product.min_stock || 10)) {
                lowStockCount++;
            }

            return {
                ...product,
                total_cost_value: costVal,
                total_price_value: priceVal
            };
        });

        return {
            products: valuationData,
            kpis: {
                totalCostValue,
                totalPriceValue,
                lowStockCount,
                totalProducts: data.length
            }
        };
    }
};
