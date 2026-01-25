const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authAdmin = require('../middleware/authAdmin');

// --- RUTAS DE MONITOREO ---

// Ruta de salud del sistema (Requiere PIN Maestro)
router.get('/health', authAdmin, adminController.getHealth);

// Ruta para ver logs de auditoría
router.get('/logs', authAdmin, adminController.getLogs);


// --- RUTAS DE MANTENIMIENTO (ACCIONES CRÍTICAS) ---

// Resetear dispositivos/terminales
router.post('/reset/devices', authAdmin, adminController.resetDevices);

// Limpiar historial de ventas (Transacciones)
router.post('/reset/sales', authAdmin, adminController.resetSales);

// Eliminar usuarios secundarios
router.post('/users/reset-secondary', authAdmin, adminController.resetSecondaryUsers);

// Reset de Fábrica (Borrar todo)
router.post('/reset/factory', authAdmin, adminController.factoryReset);

// --- RUTAS DE SINCRONIZACIÓN (SINCLA) ---

// Sincronizar productos (Pull desde la nube)
router.post('/sync/products', authAdmin, adminController.syncProducts);

// Marcar venta como sincronizada
router.post('/sync/sales/mark-synced', authAdmin, adminController.markSaleSynced);

// Actualizar licencia local
router.post('/sync/license', authAdmin, adminController.updateLicense);

// Obtener ventas pendientes de subir
router.get('/sync/sales/pending', authAdmin, adminController.getPendingSales);

module.exports = router;
