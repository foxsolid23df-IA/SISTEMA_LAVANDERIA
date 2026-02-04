// ===== SERVICIO DE SINCRONIZACIÓN (BETA) =====
// Este servicio maneja el intercambio de datos entre SQLite (Local) y Supabase (Nube)

const { Product } = require('../models/Product');
const { Sale } = require('../models/Sale');
const { StoreSetting } = require('../models/StoreSetting');

const syncService = {
    /**
     * Sincroniza productos desde Supabase hacia la DB local
     * @param {Array} supabaseProducts Lista de productos obtenida de Supabase
     */
    async pullProducts(supabaseProducts) {
        console.log(`[SyncService] Sincronizando ${supabaseProducts.length} productos...`);

        let created = 0;
        let updated = 0;

        for (const sp of supabaseProducts) {
            if (!sp || !sp.id) continue;
            try {
                // Saneamiento de datos numéricos para evitar NaN
                const cleanPrice = parseFloat(sp.price);
                const cleanCost = parseFloat(sp.cost_price);
                const cleanWholesale = parseFloat(sp.wholesale_price);
                const cleanStock = parseInt(sp.stock);
                const cleanMinStock = parseInt(sp.min_stock);
                const cleanMaxStock = parseInt(sp.max_stock);
                const cleanBarcode = sp.barcode ? String(sp.barcode).trim() : null;

                const data = {
                    name: sp.name || 'Producto sin nombre',
                    price: isNaN(cleanPrice) ? 0 : cleanPrice,
                    cost_price: isNaN(cleanCost) ? 0 : cleanCost,
                    wholesale_price: isNaN(cleanWholesale) ? 0 : cleanWholesale,
                    stock: !isNaN(cleanStock) ? cleanStock : (sp.type === 'SERVICE' ? 9999 : 0),
                    min_stock: isNaN(cleanMinStock) ? 0 : cleanMinStock,
                    max_stock: isNaN(cleanMaxStock) ? 0 : cleanMaxStock,
                    category: sp.category || 'General',
                    barcode: cleanBarcode,
                    image: sp.image_url,
                    type: sp.type || 'PRODUCT',
                    unit_type: sp.unit_type || 'PZA',
                    supabase_id: sp.id
                };

                // 1. Intentar buscar por supabase_id
                let product = await Product.findOne({ where: { supabase_id: sp.id } });

                // 2. Si no existe, intentar buscar por barcode (pero solo si el barcode no es nulo)
                if (!product && cleanBarcode) {
                    product = await Product.findOne({ where: { barcode: cleanBarcode } });
                    if (product) {
                        console.log(`[SyncService] Adopting local product '${product.name}' with barcode '${cleanBarcode}' to supabase_id ${sp.id}`);
                    }
                }

                if (!product) {
                    // 3. Si sigue sin existir, crear uno nuevo
                    await Product.create(data);
                    created++;
                } else {
                    // 4. Si ya existe (encontrado por ID o adoptado por barcode), actualizar
                    // Incluimos supabase_id en el update por si fue adoptado por barcode
                    await product.update(data);
                    updated++;
                }
            } catch (itemError) {
                console.error(`[SyncService] Error sincronizando producto ID ${sp.id} (${sp.name}):`, itemError.message);
                if (itemError.errors) {
                    itemError.errors.forEach(e => console.error(`  - Campo: ${e.path}, Error: ${e.message}`));
                }
            }
        }




        console.log(`[SyncService] Pull completado: ${created} creados, ${updated} actualizados.`);
        return { created, updated };
    },

    /**
     * Obtiene las ventas locales que no han sido sincronizadas
     */
    async getPendingSales() {
        return await Sale.findAll({
            where: { status: 'pending' },
            order: [['createdAt', 'ASC']]
        });
    },

    /**
     * Marca una venta como sincronizada
     * @param {number} localId ID en SQLite
     * @param {number} supabaseId ID generado en Supabase
     */
    async markSaleAsSynced(localId, supabaseId) {
        const sale = await Sale.findByPk(localId);
        if (sale) {
            await sale.update({
                status: 'synced',
                supabase_id: supabaseId
            });
            return true;
        }
        return false;
    },

    /**
     * Actualiza la fecha de expiración de la licencia localmente
     */
    async updateLicenseExpiry(expiryDate) {
        await StoreSetting.upsert({
            key: 'license_expires_at',
            value: expiryDate
        });
        return true;
    },

    /**
     * Obtiene la fecha de expiración de la licencia guardada localmente
     */
    async getLicenseExpiry() {
        const setting = await StoreSetting.findByPk('license_expires_at');
        return setting ? setting.value : null;
    }
};

module.exports = syncService;
