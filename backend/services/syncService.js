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
            const [product, createdNew] = await Product.findOrCreate({
                where: { supabase_id: sp.id },
                defaults: {
                    name: sp.name,
                    price: sp.price,
                    cost_price: sp.cost_price || 0,
                    wholesale_price: sp.wholesale_price || 0,
                    stock: sp.stock,
                    min_stock: sp.min_stock || 0,
                    category: sp.category,
                    barcode: sp.barcode,
                    image: sp.image_url,
                    supabase_id: sp.id
                }
            });

            if (createdNew) {
                created++;
            } else {
                // Si ya existe, actualizamos los datos locales con lo que viene de la nube
                await product.update({
                    name: sp.name,
                    price: sp.price,
                    cost_price: sp.cost_price || 0,
                    wholesale_price: sp.wholesale_price || 0,
                    stock: sp.stock,
                    min_stock: sp.min_stock || 0,
                    category: sp.category,
                    barcode: sp.barcode,
                    image: sp.image_url
                });
                updated++;
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
