/**
 * Servicio unificado de impresión
 * Maneja la impresión tanto en Electron (Silent) como en Web (Bridge/Dialog)
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const printService = {
    /**
     * Obtiene la lista de impresoras disponibles
     */
    async getPrinters() {
        try {
            if (window.electron && window.electron.getPrinters) {
                // Modo Electron: Usar API nativa
                const printers = await window.electron.getPrinters();
                return printers.map(p => ({
                    name: p.name,
                    isDefault: p.isDefault,
                    isOnline: p.status === 0
                }));
            } else {
                // Modo Web: Consultar al backend local que actúa como puente
                const response = await fetch(`${API_URL}/printer/list`);
                if (!response.ok) throw new Error('No se pudo obtener la lista de impresoras');
                return await response.json();
            }
        } catch (error) {
            console.error('Error al listar impresoras:', error);
            return [];
        }
    },

    /**
     * Envía contenido HTML a imprimir
     * @param {string} htmlContent - El contenido a imprimir (ya formateado)
     * @param {string} printerName - Nombre de la impresora (opcional)
     */
    async print(htmlContent, printerName = null, options = {}) {
        const copies = options.copies || 1;
        const normalizedPrinter = (printerName === 'Default' || printerName === 'default') ? null : printerName;

        try {
            console.log(`[PrintService] Inicio de impresión. Copias: ${copies}, Impresora: ${normalizedPrinter || 'Default'}`);

            for (let i = 0; i < copies; i++) {
                if (window.electron && window.electron.printTicket) {
                    // Modo Electron: Impresión silenciosa nativa
                    console.log(`[PrintService] Usando Electron Native Print (Copia ${i + 1}/${copies})`);
                    const result = await window.electron.printTicket(htmlContent, normalizedPrinter);
                    if (!result.success) throw new Error(result.error);
                } else {
                    // Modo Web: Intentar vía Backend Bridge
                    console.log(`[PrintService] Usando Backend Bridge Print (Copia ${i + 1}/${copies})`);
                    const response = await fetch(`${API_URL}/printer/print`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ htmlContent, printerName })
                    });

                    if (!response.ok) {
                        // Si falla el bridge, forzamos un único fallback ya que el navegador no soporta multicopia silenciosa fácil
                        console.warn('[PrintService] Bridge falló, usando fallback d navegador.');
                        this.fallbackPrint(htmlContent);
                        return true;
                    }
                }

                // Pequeña pausa entre impresiones para evitar saturación del buffer
                if (copies > 1 && i < copies - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            return true;
        } catch (error) {
            console.error('Error en impresión:', error);
            // Fallback final
            this.fallbackPrint(htmlContent);
            return false;
        }
    },

    /**
     * Fallback cuando la impresión silenciosa falla o no está disponible
     */
    fallbackPrint(htmlContent) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    },

    /**
     * Genera el HTML básico para un ticket (Ticket de Venta)
     */
    generateTicketHtml(businessData, orderData, items) {
        const width = businessData.printer_width || 80;
        const fontSize = businessData.printer_font_size || 12;
        const fontFamily = businessData.printer_font_family || "'Courier New', Courier, monospace";
        const fontWeight = businessData.printer_is_bold ? 'bold' : 'normal';

        return `
            <html>
            <head>
                <style>
                    body { 
                        font-family: ${fontFamily}; 
                        width: ${width}mm;
                        max-width: 100%;
                        margin: 0; 
                        padding: 0; /* Let inner content handle padding if needed, or set small padding */
                        font-size: ${fontSize}px;
                        font-weight: ${fontWeight};
                        padding: ${businessData.printer_margin || 0}px;
                        box-sizing: border-box;
                        overflow: hidden;
                        word-wrap: break-word;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .bold { font-weight: bold; }
                    hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; } /* Fixed layout for wrapping */
                    td, th { vertical-align: top; overflow-wrap: break-word; word-wrap: break-word; }
                    .header-logo { max-width: 50mm; display: block; margin: 0 auto 10px; }
                    @page { margin: 0; }
                </style>
            </head>
            <body>
                <div class="text-center">
                    ${businessData.logo_url ? `<img src="${businessData.logo_url}" class="header-logo">` : ''}
                    <div class="bold">${businessData.name || 'LAVANDERÍA'}</div>
                    <div>${businessData.address || ''}</div>
                    <div>Tel: ${businessData.phone || ''}</div>
                </div>
                <hr>
                <div class="text-center bold">TICKET DE VENTA #${orderData.id || '---'}</div>
                <div>Fecha: ${new Date().toLocaleString()}</div>
                <div>Cliente: ${orderData.customer_name || 'Venta General'}</div>
                <hr>
                <table>
                    <thead>
                        <tr>
                            <th align="left">Cant</th>
                            <th align="left">Prod</th>
                            <th align="right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>${item.quantity}</td>
                                <td>${item.name}</td>
                                <td align="right">$${(item.price * item.quantity).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <hr>
                <div class="text-right bold">TOTAL: $${orderData.total || '0.00'}</div>
                <hr>
                <div class="text-center">
                    ${businessData.ticket_message || '¡Gracias por su preferencia!'}
                </div>
                <hr>
                <div class="text-center" style="font-size: 10px;">
                    <div class="bold">FACTURACIÓN ELECTRÓNICA</div>
                    <div>Portal: https://lavanderia-facturacion.vercel.app/</div>
                    <div style="margin-top: 4px;">Ticket: ${orderData.ticket_uuid || 'N/A'}</div>
                    <div class="bold">PIN: ${orderData.pin_facturacion || 'N/A'}</div>
                    <div style="font-size: 8px; margin-top: 4px;">Facture antes del fin de mes en curso</div>
                </div>
            </body>
            </html>
        `;
    }
};
