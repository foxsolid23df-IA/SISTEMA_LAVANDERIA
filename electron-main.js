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
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error('Error in auto-updater: ' + errorMsg);
        if (mainWindow) {
            mainWindow.webContents.send('updater-message', 'Error: ' + errorMsg.substring(0, 40) + '...');
        }
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
                // Pequeña espera para asegurar que el contenido (especialmente imágenes) se renderice
                setTimeout(() => {
                    printWindow.webContents.print({
                        silent: true,
                        printBackground: true,
                        deviceName: printerName || '',
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
                }, 200);
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
        const backendPath = isDev
            ? path.join(__dirname, 'backend', 'index.js')
            : path.join(process.resourcesPath, 'app', 'backend', 'index.js');

        // En producción, los recursos están en CarpetaApp/resources/app/backend/index.js
        try {
            if (!fs.existsSync(backendPath)) {
                log.error(`❌ El archivo de backend no existe en: ${backendPath}`);
                return reject(new Error(`No se encontró el motor de datos en la ruta especificada.`));
            }

            // Usamos utilityProcess de Electron para independencia de Node.js externo
            backendProcess = utilityProcess.fork(backendPath, [], {
                stdio: 'pipe',
                env: { ...process.env, NODE_ENV: 'production' }
            });

            backendProcess.stdout.on('data', (data) => {
                const message = data.toString().trim();
                log.info(`[Backend]: ${message}`);
            });

            backendProcess.stderr.on('data', (data) => {
                const message = data.toString().trim();
                log.error(`[Backend ERR]: ${message}`);
            });

            backendProcess.on('spawn', () => {
                log.info('✅ Motor backend iniciado');
                // IMPORTANTE: Damos tiempo a Express para que haga el bind del puerto
                setTimeout(() => {
                    esperarServidor(`http://127.0.0.1:${PORT}/api/products`)
                        .then(resolve)
                        .catch(reject);
                }, 1500);
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
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false
        },
        icon: path.join(__dirname, 'icon.ico'),
        title: 'Sistema de Ventas - Lavandería Isla Mujeres'
    });

    // --- MANEJO DE BÁSCULA / PUERTO SERIAL (Web Serial API en Electron) ---
    // Electron NO muestra el popup nativo de selección de puerto serial.
    // Debemos manejar el evento 'select-serial-port' manualmente.

    // Mantener referencia a puertos disponibles para selección dinámica
    let availableSerialPorts = [];

    // Cuando un nuevo puerto USB se conecta físicamente
    mainWindow.webContents.session.on('serial-port-added', (event, port) => {
        log.info(`[Báscula] 🔌 Puerto serial CONECTADO: ${JSON.stringify(port)}`);
        availableSerialPorts.push(port);
    });

    // Cuando un puerto USB se desconecta físicamente
    mainWindow.webContents.session.on('serial-port-removed', (event, port) => {
        log.info(`[Báscula] ⚡ Puerto serial DESCONECTADO: ${JSON.stringify(port)}`);
        availableSerialPorts = availableSerialPorts.filter(p => p.portId !== port.portId);
    });

    // Evento CRÍTICO: cuando el frontend llama navigator.serial.requestPort()
    mainWindow.webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
        event.preventDefault();
        log.info(`[Báscula] 📋 Puertos detectados (${portList.length}): ${JSON.stringify(portList.map(p => ({ portId: p.portId, displayName: p.displayName, vendorId: p.vendorId })))}`);

        if (portList && portList.length > 0) {
            // ALGORITMO DE SELECCIÓN INTELIGENTE (Versión 2.0 - Tolerante a Drivers Genéricos)
            // 1. Buscar 'USB' en productId, vendorId o displayName (para drivers genéricos como 'USB Serial Device')
            // 2. Priorizar VendorID explícito si existe.
            // 3. Evitar COM1/COM2 nativos a menos que sean los únicos.

            const usbDevice = portList.find(p => {
                const rawString = JSON.stringify(p).toLowerCase();
                return rawString.includes('usb') || (p.vendorId);
            });

            const targetPort = usbDevice || portList[0];

            if (usbDevice) {
                log.info(`[Báscula] ✅ Dispositivo USB detectado (Probable Báscula). Seleccionando: ${usbDevice.displayName || usbDevice.portId}`);
            } else {
                log.info(`[Báscula] ⚠️ No se confirmó USB explícito. Usando el primero disponible: ${targetPort.displayName || targetPort.portId}`);
            }

            callback(targetPort.portId);
        } else {
            log.warn('[Báscula] ❌ No se encontraron puertos seriales disponibles');
            callback('');
        }
    });

    // PERMISOS: Autorizar 'serial' sin bloquear otros permisos del sistema
    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
        if (permission === 'serial') {
            return true; // Siempre permitir serial
        }
        // Para cualquier otro permiso, usar el comportamiento por defecto (true)
        return true;
    });

    // Autorizar dispositivos seriales automáticamente
    mainWindow.webContents.session.setDevicePermissionHandler((details) => {
        if (details.deviceType === 'serial') {
            log.info(`[Báscula] 🔐 Permiso de dispositivo serial otorgado: ${JSON.stringify(details.device || {})}`);
            return true;
        }
        return false;
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
        // Intentamos capturar logs si backendProcess existe
        let extraInfo = error.message;
        log.error('Detección de fallo crítico en el inicio:', extraInfo);

        dialog.showErrorBox('Error de Sistema',
            `No se pudo conectar con el motor local.\n\n` +
            `Detalle: ${extraInfo}\n\n` +
            `Por favor, asegúrese de que no haya otra instancia del programa abierta e intente reiniciar su equipo.`
        );
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (backendProcess) backendProcess.kill();
    if (process.platform !== 'darwin') app.quit();
});

