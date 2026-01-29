const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    printTicket: (html, printerName) => ipcRenderer.invoke('print-ticket', html, printerName),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    onUpdaterMessage: (callback) => ipcRenderer.on('updater-message', (event, message) => callback(message)),
    onUpdaterProgress: (callback) => ipcRenderer.on('updater-progress', (event, progress) => callback(progress)),
    isElectron: true
});
