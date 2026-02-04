/**
 * Controlador para operaciones administrativas y de soporte
 */
const sequelize = require('../db/conexion');
const SystemLog = require('../models/SystemLog');
const { Sale } = require('../models/Sale');
const { Product } = require('../models/Product');
const User = require('../models/User');
const Terminal = require('../models/Terminal');
const syncService = require('../services/syncService');

exports.getHealth = async (req, res) => {
    try {
        await SystemLog.create({
            action: 'HEALTH_CHECK',
            module: 'ADMIN_API',
            details: 'Validación de conexión a base de datos exitosa',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        await sequelize.authenticate();

        const licenseExpiry = await syncService.getLicenseExpiry();

        res.json({
            success: true,
            status: 'Operational',
            database: 'Connected',
            license_expires_at: licenseExpiry,
            timestamp: new Date().toISOString(),
            version: '1.4.0'

        });
    } catch (error) {
        await SystemLog.create({
            action: 'HEALTH_CHECK_FAILED',
            module: 'ADMIN_API',
            details: `Error: ${error.message}`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(500).json({
            success: false,
            status: 'Degraded',
            database: 'Disconnected',
            error: error.message
        });
    }
};

exports.getLogs = async (req, res) => {
    try {
        const logs = await SystemLog.findAll({
            order: [['createdAt', 'DESC']],
            limit: 100
        });
        res.json({ success: true, logs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * RESET DE DISPOSITIVOS (TERMINALES)
 * Borra todas las terminales registradas para liberar licencias
 */
exports.resetDevices = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const count = await Terminal.count();
        await Terminal.destroy({ where: {}, truncate: true, transaction: t });

        await SystemLog.create({
            action: 'RESET_DEVICES',
            module: 'ADMIN_API',
            details: `Se liberaron ${count} terminales/dispositivos.`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        }, { transaction: t });

        await t.commit();
        res.json({ success: true, message: `Se han liberado ${count} dispositivos correctamente.` });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * LIMPIAR TRANSACCIONES
 * Borra historial de ventas pero mantiene productos y usuarios
 */
exports.resetSales = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const count = await Sale.count();
        await Sale.destroy({ where: {}, truncate: true, transaction: t });

        await SystemLog.create({
            action: 'RESET_SALES',
            module: 'ADMIN_API',
            details: `Se eliminaron ${count} registros de ventas/transacciones.`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        }, { transaction: t });

        await t.commit();
        res.json({ success: true, message: `Se han eliminado ${count} ventas. El inventario permanece intacto.` });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * RESET DE USUARIOS SECUNDARIOS
 * Elimina todos los usuarios excepto el Administrador inicial
 */
exports.resetSecondaryUsers = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        // Obtenemos el admin (usualmente el primero creado o con profile admin)
        const admins = await User.findAll({ where: { profile: 'admin' }, order: [['createdAt', 'ASC']] });
        const primaryAdminId = admins[0]?.id;

        if (!primaryAdminId) throw new Error("No se encontró un Administrador principal para preservar.");

        const deletedCount = await User.destroy({
            where: {
                id: { [sequelize.Sequelize.Op.ne]: primaryAdminId }
            },
            transaction: t
        });

        await SystemLog.create({
            action: 'RESET_USERS',
            module: 'ADMIN_API',
            details: `Se eliminaron ${deletedCount} usuarios secundarios. Se preservó el Admin ID: ${primaryAdminId}`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        }, { transaction: t });

        await t.commit();
        res.json({ success: true, message: `Se han eliminado ${deletedCount} usuarios. Solo el Administrador tiene acceso.` });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * RESET DE FÁBRICA (BORRAR TODO)
 * Limpia absolutamente todas las tablas excepto la configuración de sistema
 */
exports.factoryReset = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        // 1. Borrar Ventas
        await Sale.destroy({ where: {}, truncate: true, transaction: t });
        // 2. Borrar Productos
        await Product.destroy({ where: {}, truncate: true, transaction: t });
        // 3. Borrar Terminales
        await Terminal.destroy({ where: {}, truncate: true, transaction: t });
        // 4. Borrar Usuarios Secundarios (Preservar 1 Admin)
        const admins = await User.findAll({ where: { profile: 'admin' }, order: [['createdAt', 'ASC']] });
        const primaryAdminId = admins[0]?.id;
        if (primaryAdminId) {
            await User.destroy({
                where: { id: { [sequelize.Sequelize.Op.ne]: primaryAdminId } },
                transaction: t
            });
        }

        await SystemLog.create({
            action: 'FACTORY_RESET',
            module: 'ADMIN_API',
            details: 'RESETEO TOTAL DEL SISTEMA EJECUTADO.',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        }, { transaction: t });

        await t.commit();
        res.json({ success: true, message: "El sistema ha sido reseteado a valores de fábrica. Todo el historial y productos han sido eliminados." });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * SINCRONIZAR PRODUCTOS (Recibe lista de Supabase)
 */
exports.syncProducts = async (req, res) => {
    try {
        const { products } = req.body;
        if (!Array.isArray(products)) {
            return res.status(400).json({ success: false, message: 'Se requiere una lista de productos.' });
        }

        const result = await syncService.pullProducts(products);

        // Registro de auditoría (No bloqueante para la respuesta)
        try {
            await SystemLog.create({
                action: 'SYNC_PRODUCTS',
                module: 'SYNC_API',
                details: `Sincronizados ${products.length} productos (Nuevos: ${result.created}, Actualizados: ${result.updated})`,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
        } catch (logError) {
            console.error('[AdminController] Error al guardar log de sincronización:', logError.message);
        }

        res.json({ success: true, result });
    } catch (error) {
        console.error('[AdminController] Error crítico en syncProducts:', error);

        // Extraer detalles si es un error de validación de Sequelize
        const validationErrors = error.errors ? error.errors.map(e => ({
            field: e.path,
            message: e.message,
            value: e.value
        })) : null;

        res.status(500).json({
            success: false,
            error: error.message,
            errorName: error.name,
            details: validationErrors || error,
            fullError: JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error))),
            stack: error.stack
        });

    }
};

/**
 * OBTENER VENTAS PENDIENTES
 */
exports.getPendingSales = async (req, res) => {
    try {
        const sales = await syncService.getPendingSales();
        res.json({ success: true, sales });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * MARCAR VENTA COMO SINCRONIZADA
 */
exports.markSaleSynced = async (req, res) => {
    try {
        const { localId, supabaseId } = req.body;
        const success = await syncService.markSaleAsSynced(localId, supabaseId);

        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'Venta local no encontrada.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * ACTUALIZAR LICENCIA (Sincronización)
 */
exports.updateLicense = async (req, res) => {
    try {
        const { expiresAt } = req.body;
        if (!expiresAt) {
            return res.status(400).json({ success: false, message: 'Fecha de expiración requerida.' });
        }

        await syncService.updateLicenseExpiry(expiresAt);

        await SystemLog.create({
            action: 'SYNC_LICENSE',
            module: 'SYNC_API',
            details: `Licencia sincronizada. Nueva expiración: ${expiresAt}`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
