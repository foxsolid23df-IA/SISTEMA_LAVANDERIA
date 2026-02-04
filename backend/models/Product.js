const { DataTypes } = require('sequelize');
const sequelize = require('../db/conexion');

// Define el modelo Product para la tabla 'Product'
const Product = sequelize.define('Product', {
    name: { type: DataTypes.STRING, allowNull: false },      // Nombre del producto
    price: { type: DataTypes.FLOAT, allowNull: false },      // Precio del producto
    cost_price: { type: DataTypes.FLOAT, defaultValue: 0 },  // Precio de costo
    wholesale_price: { type: DataTypes.FLOAT, defaultValue: 0 }, // Precio al por mayor
    stock: { type: DataTypes.INTEGER, allowNull: false },    // Stock disponible
    min_stock: { type: DataTypes.INTEGER, defaultValue: 0 }, // Stock mínimo para alertas
    max_stock: { type: DataTypes.INTEGER, defaultValue: 0 }, // Stock máximo
    category: { type: DataTypes.STRING },                    // Categoría
    barcode: { type: DataTypes.STRING, unique: true },       // Código de barras único
    image: { type: DataTypes.TEXT },                         // URL o Base64 de imagen (opcional)
    unit_type: { type: DataTypes.STRING, defaultValue: 'UNIDAD' }, // UNIDAD, KG, etc
    type: { type: DataTypes.STRING, defaultValue: 'PRODUCT' },      // PRODUCT o SERVICE
    supabase_id: { type: DataTypes.BIGINT, unique: true }     // ID de referencia en Supabase
}, {
    timestamps: true,            // Habilitamos para rastrear modificaciones locales
    freezeTableName: true        // Usa el nombre 'Product' tal cual, sin pluralizar
});

module.exports = { Product };