const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

exports.getPrinters = (req, res) => {
    // Comando universal para listar impresoras en Windows vía PowerShell
    const command = "powershell -Command \"Get-Printer | Select-Object Name, PrinterStatus, IsDefault | ConvertTo-Json\"";
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error listing printers: ${error}`);
            // Fallback: Si falla PowerShell, intentamos wmic
            exec("wmic printer get name,default", (err2, stdout2) => {
                if (err2) return res.status(500).json({ error: 'No se pudieron listar las impresoras' });
                const printers = stdout2.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && line !== 'Name' && line !== 'Default')
                    .map(name => ({ name, isDefault: false }));
                return res.json(printers);
            });
            return;
        }

        try {
            const data = JSON.parse(stdout);
            const printers = Array.isArray(data) ? data : [data];
            res.json(printers.map(p => ({
                name: p.Name,
                isDefault: p.IsDefault,
                status: p.PrinterStatus
            })));
        } catch (e) {
            res.status(500).json({ error: 'Error al procesar lista de impresoras' });
        }
    });
};

exports.printTicket = (req, res) => {
    const { htmlContent, printerName } = req.body;
    
    if (!htmlContent) {
        return res.status(400).json({ error: 'Contenido vacío' });
    }

    // Para impresión desde Web vía Backend en Windows:
    // 1. Guardamos el HTML en un archivo temporal
    // 2. Usamos PowerShell para imprimirlo (o una utilidad de sistema)
    // NOTA: Imprimir HTML puro a una térmica requiere renderizado. 
    // Como no tenemos un navegador en el backend, una opción es usar 'Notepad' para texto plano
    // o simplemente avisar que la impresión silenciosa desde Web requiere que el Backend 
    // tenga una utilidad de impresión instalada (como SumatraPDF o similar).
    
    // De momento, implementaremos el guardado y el comando Out-Printer de PowerShell para texto plano/PDF si es posible.
    const tempFile = path.join(os.tmpdir(), `ticket_${Date.now()}.html`);
    
    fs.writeFile(tempFile, htmlContent, (err) => {
        if (err) return res.status(500).json({ error: 'Error al crear archivo temporal' });

        // Intento de impresión básica vía PowerShell (Funciona mejor con texto o imágenes)
        // Para tickets térmicos complejos desde WEB, lo ideal es enviar ESC/POS raw
        const printerCmd = printerName ? `-Name "${printerName}"` : "";
        const command = `powershell -Command "Start-Process -FilePath '${tempFile}' -Verb Print"`;

        exec(command, (error) => {
            // Borramos el temporal después de un momento
            setTimeout(() => fs.unlink(tempFile, () => {}), 5000);
            
            if (error) {
                return res.status(500).json({ error: 'Error al enviar a la impresora: ' + error.message });
            }
            res.json({ success: true, message: 'Ticket enviado a la cola de impresión' });
        });
    });
};
