// ===== ELECTRON MAIN PROCESS (FINAL STABILITY VERSION) =====
const { app, BrowserWindow, dialog, utilityProcess } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;
let backendProcess;

const PORT = 3001;
const isDev = !app.isPackaged;

function esperarServidor(url, intentos = 50) {
    return new Promise((resolve, reject) => {
        const verificar = (intento) => {
            if (intento >= intentos) {
                reject(new Error('El motor de datos no respondió.'));
                return;
            }
            http.get(url, (res) => {
                if (res.statusCode === 200) resolve();
                else setTimeout(() => verificar(intento + 1), 600);
            }).on('error', () => {
                setTimeout(() => verificar(intento + 1), 600);
            });
        };
        verificar(0);
    });
}

function iniciarBackend() {
    return new Promise((resolve, reject) => {
        // En producción, los recursos están en CarpetaApp/resources/app/backend/index.js
        const backendPath = isDev
            ? path.join(__dirname, 'backend', 'index.js')
            : path.join(process.resourcesPath, 'app', 'backend', 'index.js');

        console.log(`[Main] Backend Path: ${backendPath}`);

        try {
            // Usamos utilityProcess de Electron para independencia de Node.js externo
            backendProcess = utilityProcess.fork(backendPath, [], {
                stdio: 'pipe',
                env: { ...process.env, NODE_ENV: 'production' }
            });

            backendProcess.stdout.on('data', (data) => console.log(`[Backend]: ${data}`));
            backendProcess.stderr.on('data', (data) => console.error(`[Backend ERR]: ${data}`));

            backendProcess.on('spawn', () => {
                console.log('✅ Motor backend iniciado');
                // IMPORTANTE: Damos tiempo a Express para que haga el bind del puerto
                setTimeout(() => {
                    // Probamos con 127.0.0.1 que es lo que configuramos en backend/index.js
                    esperarServidor(`http://127.0.0.1:${PORT}/api/products`)
                        .then(resolve)
                        .catch(reject);
                }, 1000);
            });

            backendProcess.on('exit', (code) => {
                console.log(`🛑 Backend salió con código ${code}`);
            });

        } catch (error) {
            reject(error);
        }
    });
}

function crearVentana() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // Deshabilitamos temporalmente para asegurar que el fetch local no sea bloqueado
        },
        icon: path.join(__dirname, 'icon.ico'),
        title: 'Sistema de Ventas - Lavandería Isla Mujeres'
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        const indexPath = path.join(__dirname, 'dist', 'index.html');
        mainWindow.loadFile(indexPath);
        // Ocultamos la consola en producción para el usuario final
        // mainWindow.webContents.openDevTools(); 
    }
}

app.whenReady().then(async () => {
    try {
        await iniciarBackend();
        crearVentana();
    } catch (error) {
        dialog.showErrorBox('Error de Sistema', `No se pudo conectar con el motor local.\n\n${error.message}`);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (backendProcess) backendProcess.kill();
    if (process.platform !== 'darwin') app.quit();
});
