const { DataTypes } = require('sequelize');
const sequelize = require('../db/conexion');

// Almacena variables de configuración global y licencia (Copia local de la nube)
const StoreSetting = sequelize.define('StoreSetting', {
    key: { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.TEXT },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    timestamps: false,
    freezeTableName: true
});

module.exports = { StoreSetting };
