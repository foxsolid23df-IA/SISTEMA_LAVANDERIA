const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    printTicket: (html, printerName) => ipcRenderer.invoke('print-ticket', html, printerName),
    isElectron: true
});
