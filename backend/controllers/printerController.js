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

    // Guardar el HTML como archivo temporal con encoding UTF-8 BOM
    const tempFile = path.join(os.tmpdir(), `ticket_${Date.now()}.html`);
    
    // Asegurar BOM UTF-8 para correcta interpretación de caracteres especiales (ñ, á, etc.)
    const bom = '\uFEFF';
    const content = htmlContent.startsWith('\uFEFF') ? htmlContent : bom + htmlContent;
    
    fs.writeFile(tempFile, content, { encoding: 'utf8' }, (err) => {
        if (err) return res.status(500).json({ error: 'Error al crear archivo temporal' });

        // Normalizamos la ruta del archivo para que funcione en URLs file://
        const fileUrl = `file:///${tempFile.replace(/\\/g, '/')}`;

        // Estrategia de impresión: 
        // 1. Si hay impresora específica → setear como predeterminada temporal, imprimir con rundll32, restaurar
        // 2. Si no → imprimir con el método del sistema
        let command;

        if (printerName) {
            // Método 1: Imprimir con impresora específica
            // Setear la impresora como predeterminada, imprimir, y restaurar la original
            const safeprinterName = printerName.replace(/'/g, "''");
            
            command = `powershell -NoProfile -Command "` +
                // Guardar impresora actual
                `$original = (Get-CimInstance -ClassName Win32_Printer | Where-Object {$_.Default}).Name; ` +
                // Setear la impresora del ticket como predeterminada
                `$target = '${safeprinterName}'; ` +
                `$printer = Get-CimInstance -ClassName Win32_Printer | Where-Object {$_.Name -eq $target}; ` +
                `if ($printer) { ` +
                    `Invoke-CimMethod -InputObject $printer -MethodName SetDefaultPrinter | Out-Null; ` +
                    // Imprimir via Start-Process con -Verb Print (usa la predeterminada)
                    `Start-Process '${tempFile}' -Verb Print -WindowStyle Hidden; ` +
                    `Start-Sleep -Seconds 3; ` +
                    // Restaurar la impresora original
                    `if ($original -and $original -ne $target) { ` +
                        `$origPrinter = Get-CimInstance -ClassName Win32_Printer | Where-Object {$_.Name -eq $original}; ` +
                        `if ($origPrinter) { Invoke-CimMethod -InputObject $origPrinter -MethodName SetDefaultPrinter | Out-Null } ` +
                    `} ` +
                `} else { ` +
                    // Si no se encontró la impresora, imprimir con la predeterminada del sistema
                    `Start-Process '${tempFile}' -Verb Print -WindowStyle Hidden ` +
                `}"`;
        } else {
            // Método 2: Imprimir con la impresora predeterminada del sistema
            command = `powershell -NoProfile -Command "Start-Process '${tempFile}' -Verb Print -WindowStyle Hidden"`;
        }

        exec(command, { timeout: 30000 }, (error) => {
            // Borramos el temporal después de un momento
            setTimeout(() => fs.unlink(tempFile, () => {}), 15000);
            
            if (error) {
                console.error('[PrintController] Error de impresión:', error.message);
                
                // Fallback: Abrir el archivo para que el usuario lo imprima manualmente
                const fallbackCmd = `powershell -NoProfile -Command "Start-Process '${tempFile}'"`;
                exec(fallbackCmd, (err2) => {
                    if (err2) {
                        return res.status(500).json({ error: 'Error al enviar a la impresora: ' + error.message });
                    }
                    res.json({ success: true, message: 'Ticket abierto para impresión manual', fallback: true });
                });
                return;
            }
            res.json({ success: true, message: 'Ticket enviado a la cola de impresión' });
        });
    });
};
