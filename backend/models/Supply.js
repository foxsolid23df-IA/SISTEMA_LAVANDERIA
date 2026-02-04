const { DataTypes } = require('sequelize');
const sequelize = require('../db/conexion');

// Modelo Supply para control de insumos internos (consumo de lavandería)
const Supply = sequelize.define('Supply', {
    name: { type: DataTypes.STRING, allowNull: false },      // Nombre del insumo (ej. Suavizante Libre de Enjuague)
    unit_measure: { type: DataTypes.STRING, defaultValue: 'GALON' }, // GALON, LITRO, BOTE, etc
    current_stock: { type: DataTypes.FLOAT, defaultValue: 0 }, // Stock teórico actual
    min_stock: { type: DataTypes.FLOAT, defaultValue: 0 },    // Mínimo para recompra
    image: { type: DataTypes.TEXT }                           // Imagen opcional
}, {
    timestamps: true,
    freezeTableName: true
});

module.exports = { Supply };
