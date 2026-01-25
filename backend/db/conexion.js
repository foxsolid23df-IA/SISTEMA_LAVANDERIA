// Importa la clase Sequelize para manejar la conexión y los modelos
const { Sequelize } = require('sequelize');
// Importa path para construir rutas de archivos de forma segura
const path = require('path');

// Configuración con SQLite
// En producción (Electron), usamos AppData para evitar problemas de permisos de escritura
const isProd = process.env.NODE_ENV === 'production' || !!process.env.APPDATA;
const dbDir = isProd 
    ? path.join(process.env.APPDATA || process.env.HOME, 'sistema-ventas-lavanderia', 'data')
    : path.join(__dirname, '..', 'data');

// Asegurar que la carpeta exista
const fs = require('fs');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'sistema-pos.db');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
});

// Exporta la instancia para usarla en modelos y servicios
module.exports = sequelize;