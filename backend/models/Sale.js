const { DataTypes } = require('sequelize');
const sequelize = require('../db/conexion');

// Define el modelo Sale para la tabla 'Sale'
const Sale = sequelize.define('Sale', {
    folio: { type: DataTypes.INTEGER, unique: true },        // Consecutivo sin saltos
    total: { type: DataTypes.FLOAT, allowNull: false },      // Monto total de la venta
    items: { type: DataTypes.TEXT, allowNull: false },       // Detalle de productos vendidos (JSON string)
    payment_method: { type: DataTypes.STRING, defaultValue: 'efectivo' },
    terminal_id: { type: DataTypes.UUID },                   // Terminal que realizó la venta
    status: { type: DataTypes.STRING, defaultValue: 'pending' }, // 'pending' | 'synced'
    has_tax: { type: DataTypes.BOOLEAN, defaultValue: false },
    tax_amount: { type: DataTypes.FLOAT, defaultValue: 0 },
    invoice_requested: { type: DataTypes.BOOLEAN, defaultValue: false },
    facturado: { type: DataTypes.BOOLEAN, defaultValue: false },
    pin_facturacion: { type: DataTypes.STRING, allowNull: true },
    ticket_uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    supabase_id: { type: DataTypes.BIGINT, unique: true },   // ID en Supabase tras sincronizar
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
    timestamps: true,            // Habilitamos para auditoría local
    freezeTableName: true,       // Usa el nombre 'Sale' tal cual, sin pluralizar
    indexes: [
        {
            fields: ['createdAt']  // Índice para optimizar consultas por fecha
        },
        {
            fields: ['status']     // Índice para buscar ventas pendientes de sincronizar
        }
    ]
});

module.exports = { Sale };