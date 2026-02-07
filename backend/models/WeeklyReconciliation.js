const { DataTypes } = require('sequelize');
const sequelize = require('../db/conexion');

// Modelo para el corte semanal de insumos
const WeeklyReconciliation = sequelize.define('WeeklyReconciliation', {
    supply_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    theoretical_stock: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    physical_stock: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    difference: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    reconciliation_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    notes: {
        type: DataTypes.STRING
    },
    responsible: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {

        type: DataTypes.STRING,
        defaultValue: 'CLOSED' // OPEN o CLOSED
    }
}, {
    timestamps: true,
    freezeTableName: true
});

// Association
const { Supply } = require('./Supply');
WeeklyReconciliation.belongsTo(Supply, { foreignKey: 'supply_id', as: 'supply' });

module.exports = { WeeklyReconciliation };
