// ===== ELECTRON MAIN PROCESS (FINAL STABILITY VERSION) =====
const { app, BrowserWindow, dialog, utilityProcess, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Configuración de Logs
log.transports.file.level = 'info';
autoUpdater.logger = log;
log.info('App starting...');

let mainWindow;
let backendProcess;

const PORT = 3001;
const isDev = !app.isPackaged;

// Configuración de autoUpdater
autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = false;

function setupAutoUpdater() {
    if (isDev) return;

    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for update...');
        if (mainWindow) mainWindow.webContents.send('updater-message', 'Buscando actualizaciones...');
    });

    autoUpdater.on('update-available', (info) => {
        log.info('Update available.');
        if (mainWindow) mainWindow.webContents.send('updater-message', 'Nueva versión disponible. Descargando...');
    });

    autoUpdater.on('update-not-available', (info) => {
        log.info('Update not available.');
        if (mainWindow) mainWindow.webContents.send('updater-message', 'Sistema actualizado.');
    });

    autoUpdater.on('error', (err) => {
        log.error('Error in auto-updater: ' + err);
        if (mainWindow) mainWindow.webContents.send('updater-message', 'Error al buscar actualización.');
    });

    autoUpdater.on('download-progress', (progressObj) => {
        let log_message = "Download speed: " + progressObj.bytesPerSecond;
        log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
        log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
        log.info(log_message);
        if (mainWindow) mainWindow.webContents.send('updater-progress', progressObj.percent);
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info('Update downloaded.');
        if (mainWindow) mainWindow.webContents.send('updater-message', 'Actualización lista.');
        
        dialog.showMessageBox({
            type: 'info',
            title: 'Actualización Lista',
            message: `Una nueva versión (${info.version}) ha sido descargada. El sistema se reiniciará para aplicar los cambios.`,
            buttons: ['Reiniciar Ahora', 'Más tarde']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    // Verificar actualizaciones cada hora
    setInterval(() => {
        autoUpdater.checkForUpdates();
    }, 60 * 60 * 1000);

    // Verificación inicial
    autoUpdater.checkForUpdates();
}

// --- IPC HANDLERS PARA IMPRESIÓN Y UPDATER ---

ipcMain.handle('check-for-updates', async () => {
    if (isDev) return { message: 'Modo Desarrollo' };
    try {
        const result = await autoUpdater.checkForUpdates();
        return { success: true, updateInfo: result.updateInfo };
    } catch (error) {
        log.error('Manual update check error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-printers', async () => {
    return await mainWindow.webContents.getPrintersAsync();
});

ipcMain.handle('print-ticket', async (event, htmlContent, printerName) => {
    try {
        const printWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: true
            }
        });

        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

        return new Promise((resolve) => {
            printWindow.webContents.on('did-finish-load', () => {
                printWindow.webContents.print({
                    silent: true,
                    printBackground: true,
                    deviceName: printerName || '', // Si es vacío usa la predeterminada
                    margins: { marginType: 'none' }
                }, (success, failureReason) => {
                    printWindow.close();
                    if (!success) {
                        console.error('Error al imprimir:', failureReason);
                        resolve({ success: false, error: failureReason });
                    } else {
                        resolve({ success: true });
                    }
                });
            });
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

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
            preload: path.join(__dirname, 'preload.js'), // Agregamos preload para seguridad
            webSecurity: false 
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
    }
}

app.whenReady().then(async () => {
    try {
        setupAutoUpdater();
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

