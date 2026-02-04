const { DataTypes } = require('sequelize');
const sequelize = require('../db/conexion');

// Modelo para registrar movimientos de insumos (entradas, consumos diarios, ajustes)
const SupplyMovement = sequelize.define('SupplyMovement', {
    supply_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('ENTRY_WEEKLY', 'USAGE_MORNING', 'USAGE_AFTERNOON', 'ADJUSTMENT'),
        allowNull: false
    },
    quantity: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    notes: {
        type: DataTypes.STRING
    },
    user_id: {
        type: DataTypes.INTEGER
    },
    date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    user_name: {
        type: DataTypes.STRING,
        allowNull: true // Puede ser nulo para registros antiguos
    },
    usage_date: {
        type: DataTypes.DATEONLY, // Solo fecha YYYY-MM-DD
        defaultValue: DataTypes.NOW
    }

}, {
    timestamps: true,
    freezeTableName: true
});

module.exports = { SupplyMovement };
