// ===== SERVIDOR BACKEND PRINCIPAL =====
// Este archivo inicia el servidor Express, importa modelos y rutas, y deja todo listo para funcionar en cualquier PC.

// Cargar variables de entorno desde .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const sequelize = require('./db/conexion');

// Importar modelos para que Sequelize los registre antes de sync
require('./models/Product');
require('./models/Sale');
const User = require('./models/User');
require('./models/SystemLog');
require('./models/Terminal'); // <--- Registro de terminales
require('./models/StoreSetting'); // <--- Registro de configuración y licencia

// Crear la app de Express
const app = express();

// Configurar CORS para producción
const corsOptions = {
    origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
    optionsSuccessStatus: 200
};

// En modo Electron, permitir todas las conexiones locales y encabezados necesarios
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-master-pin'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Importar y usar rutas
const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes'); // <--- Nueva ruta

app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes); // <--- Nueva ruta

// Puerto y host configurables por variable de entorno
const PORT = 3001; // Forzamos 3001 para Electron
const HOST = '127.0.0.1'; // Localhost puro

async function startServer() {
    try {
        await sequelize.sync({ alter: true }); // Sincroniza modelos con la base de datos (altera tablas si es necesario)

        // Crear administrador inicial si no existe
        const adminExists = await User.findOne({ where: { profile: 'admin' } });
        if (!adminExists) {
            console.log('🌱 Creando administrador inicial...');
            await User.create({
                name: 'Administrador',
                profile: 'admin',
                pin: '1234'
            });
            console.log('✅ Administrador creado con PIN: 1234');
        }

        // Iniciar servidor
        app.listen(PORT, HOST, () => {
            console.log(`✅ Backend escuchando en http://${HOST}:${PORT}`);
        });
    } catch (err) {
        console.error('❌ Error al sincronizar la base de datos:', err.message);
        // No cerramos el proceso, intentamos seguir para que al menos la API responda errores
        app.listen(PORT, HOST, () => {
            console.log(`⚠️ Backend en modo degradado (DB Error) en puerto ${PORT}`);
        });
    }
}

startServer();