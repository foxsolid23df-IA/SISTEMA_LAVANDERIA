/**
 * Servicio unificado de impresiÃ³n para POS
 * Convierte el ticket HTML a imagen via html2canvas para garantizar
 * que la salida fÃ­sica sea idÃ©ntica a la vista previa.
 */

import html2canvas from 'html2canvas';
import { platform } from '../utils/platform';
import { posBluetoothPrinter } from './posBluetoothPrinter';
import { escposTicketBuilder } from './escposTicketBuilder';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const printService = {
    /**
     * Obtiene la lista de impresoras disponibles
     */
    async getPrinters() {
        try {
            if (platform.isAndroid) {
                const devices = await posBluetoothPrinter.listPairedDevices();
                return devices.map((device) => ({
                    name: device.name || device.address,
                    address: device.address || device.id,
                    id: device.id || device.address,
                    connectionType: 'bluetooth',
                    isDefault: false,
                    isOnline: true,
                }));
            }

            if (window.electron && window.electron.getPrinters) {
                // Modo Electron: Usar API nativa
                const printers = await window.electron.getPrinters();
                return printers.map(p => ({
                    name: p.name,
                    isDefault: p.isDefault,
                    isOnline: p.status === 0
                }));
            } else {
                // Modo Web: Consultar al backend local que actÃºa como puente
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
     * Captura un elemento DOM como imagen base64 usando html2canvas
     * @param {HTMLElement} element - El elemento DOM del ticket
     * @param {object} settings - ConfiguraciÃ³n del negocio (ancho, fuente, etc.)
     * @returns {Promise<string>} - Imagen en formato base64 (data:image/png;base64,...)
     */
    async captureTicketAsImage(element, settings = {}) {
        if (!element) throw new Error('Elemento del ticket no proporcionado');

        const width = settings.printer_width || 80;
        // Convertir mm a px (1mm â‰ˆ 3.78px a 96dpi)
        const widthPx = Math.round(width * 3.78);

        const canvas = await html2canvas(element, {
            scale: 2,                    // Alta resoluciÃ³n para nitidez en impresiÃ³n
            useCORS: true,               // Permitir imÃ¡genes externas (logo)
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: widthPx,
            windowWidth: widthPx,
            logging: false,
            onclone: (clonedDoc) => {
                // Asegurar que el elemento clonado sea visible y tenga los estilos correctos
                const clonedElement = clonedDoc.querySelector('.ticket-venta');
                if (clonedElement) {
                    clonedElement.style.position = 'relative';
                    clonedElement.style.left = '0';
                    clonedElement.style.top = '0';
                    clonedElement.style.overflow = 'visible';
                    clonedElement.style.transform = 'none';
                    clonedElement.style.width = `${widthPx}px`;
                    clonedElement.style.maxWidth = `${widthPx}px`;
                    clonedElement.style.boxSizing = 'border-box';
                    clonedElement.style.paddingBottom = '30px';
                    // Forzar todos los hijos a no desbordar
                    clonedElement.querySelectorAll('*').forEach(child => {
                        child.style.maxWidth = '100%';
                        child.style.boxSizing = 'border-box';
                    });
                }
            }
        });

        return canvas.toDataURL('image/png');
    },

    /**
     * Genera el HTML wrapper para imprimir una imagen de ticket
     * @param {string} imageBase64 - La imagen del ticket en base64
     * @param {object} settings - ConfiguraciÃ³n de impresiÃ³n
     * @returns {string} - HTML completo listo para imprimir
     */
    generateImagePrintHtml(imageBase64, settings = {}) {
        const width = settings.printer_width || 80;

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket POS</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { 
            margin: 0; 
            size: ${width}mm auto; 
        }
        html, body { 
            margin: 0; 
            padding: 0; 
            width: ${width}mm;
            background: white;
        }
        img { 
            display: block; 
            width: 100%; 
            height: auto; 
            max-width: ${width}mm;
        }
        @media print {
            html, body { 
                width: ${width}mm; 
                margin: 0; 
                padding: 0; 
            }
        }
    </style>
</head>
<body>
    <img src="${imageBase64}" alt="Ticket" />
</body>
</html>`;
    },

    /**
     * EnvÃ­a contenido a imprimir
     * Prioriza html2canvas (imagen) para impresoras tÃ©rmicas,
     * con fallback a HTML directo si no hay elemento DOM disponible.
     * 
     * @param {string|HTMLElement} content - HTML string o elemento DOM del ticket
     * @param {string} printerName - Nombre de la impresora (opcional)
     * @param {object} options - { copies, settings, useImageMode }
     */
    async print(content, printerName = null, options = {}) {
        const copies = options.copies || 1;
        const settings = options.settings || {};
        const normalizedPrinter = (printerName === 'Default' || printerName === 'default') ? null : printerName;

        try {
            console.log(`[PrintService] Inicio de impresiÃ³n. Copias: ${copies}, Impresora: ${normalizedPrinter || 'Default'}`);

            let printHtml;

            // Si content es un elemento DOM, extraer HTML directo del DOM
            // (html2canvas generaba imÃ¡genes demasiado grandes para el buffer de impresoras tÃ©rmicas)
            if (content instanceof HTMLElement) {
                console.log('[PrintService] Modo HTML directo â€” Extrayendo del DOM');
                printHtml = this.extractHtmlFromElement(content, settings);
            } else {
                // Compatibilidad: si recibimos HTML string, asegurar charset UTF-8
                console.log('[PrintService] Modo HTML (legacy) â€” Contenido string');
                printHtml = this.ensureHtmlCharset(content);
            }

            if (platform.isAndroid) {
                const printerAddress = settings.printer_bluetooth_address || normalizedPrinter;
                if (!printerAddress) {
                    throw new Error('Configura una impresora Bluetooth POS antes de imprimir en Android.');
                }

                const data = escposTicketBuilder.build(options.ticketData, printHtml, settings);
                for (let i = 0; i < copies; i++) {
                    await posBluetoothPrinter.printTicket({ address: printerAddress, data });
                    if (copies > 1 && i < copies - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
                return true;
            }

            for (let i = 0; i < copies; i++) {
                if (window.electron && window.electron.printTicket) {
                    // Modo Electron: ImpresiÃ³n silenciosa nativa
                    console.log(`[PrintService] Usando Electron Native Print (Copia ${i + 1}/${copies})`);
                    const result = await window.electron.printTicket(printHtml, normalizedPrinter);
                    if (!result.success) {
                        console.error(`[PrintService] âŒ Electron Print fallÃ³:`, result.error);
                        throw new Error(result.error);
                    } else {
                        console.log(`[PrintService] âœ… Copia ${i + 1}/${copies} impresa exitosamente`);
                    }
                } else {
                    // Modo Web: Intentar vÃ­a Backend Bridge
                    console.log(`[PrintService] Usando Backend Bridge Print (Copia ${i + 1}/${copies})`);
                    const response = await fetch(`${API_URL}/printer/print`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            htmlContent: printHtml, 
                            printerName: normalizedPrinter 
                        })
                    });

                    if (!response.ok) {
                        console.warn('[PrintService] Bridge fallÃ³, usando fallback de navegador.');
                        this.fallbackPrint(printHtml);
                        return true;
                    }
                }

                // Pausa entre impresiones para evitar saturaciÃ³n del buffer
                if (copies > 1 && i < copies - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            return true;
        } catch (error) {
            console.error('[PrintService] Error en impresiÃ³n:', error);
            // Fallback final: abrir en ventana del navegador
            if (typeof content === 'string') {
                this.fallbackPrint(content);
            }
            return false;
        }
    },

    /**
     * Extrae el HTML de un elemento DOM y lo envuelve en un documento HTML
     * completo con estilos de impresiÃ³n para impresoras tÃ©rmicas.
     * Reemplaza html2canvas que generaba imÃ¡genes demasiado grandes.
     * @param {HTMLElement} element - El elemento DOM del ticket
     * @param {object} settings - ConfiguraciÃ³n del negocio
     * @returns {string} - HTML completo listo para imprimir
     */
    extractHtmlFromElement(element, settings = {}) {
        const width = settings.printer_width || 80;
        const fontSize = settings.printer_font_size || 12;
        const fontFamily = settings.printer_font_family || "'Courier New', Courier, monospace";
        const fontWeight = settings.printer_is_bold ? 'bold' : 'normal';
        const margin = settings.printer_margin || 0;

        // Obtener el HTML renderizado directamente del componente React
        const ticketInnerHtml = element.outerHTML;

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        /* ===== RESET GLOBAL ===== */
        *, *::before, *::after { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box !important; 
        }
        
        @page { 
            margin: 0 !important; 
            size: ${width}mm auto; 
        }
        
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${width}mm;
            max-width: ${width}mm;
            background: white;
            color: black;
            font-family: ${fontFamily};
            font-size: ${fontSize}px;
            font-weight: ${fontWeight};
            -webkit-print-color-adjust: exact;
            overflow-x: hidden;
        }
        
        /* ===== CONTENEDOR PRINCIPAL DEL TICKET =====
         * CRÃTICO: Los !important sobreescriben los estilos inline del JSX
         * que aplican width en mm. En contexto de impresiÃ³n, el body YA
         * tiene el ancho correcto, asÃ­ que el ticket debe ser 100%.
         */
        .ticket-venta {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            font-family: ${fontFamily};
            font-size: ${fontSize}px;
            color: #000;
            background: #fff;
            padding-top: 0 !important;
            padding-left: ${margin}px !important;
            padding-right: ${margin}px !important;
            padding-bottom: 30px !important;
            margin: 0 !important;
            overflow: visible !important;
            overflow-wrap: break-word;
            word-break: break-word;
        }
        
        /* ===== TODOS LOS HIJOS: Prevenir desbordamiento lateral ===== */
        .ticket-venta * {
            max-width: 100% !important;
            box-sizing: border-box !important;
        }
        
        /* ===== SECCIONES DEL TICKET ===== */
        .ticket-venta .ticket-header { text-align: center; margin-bottom: 8px; }
        .ticket-venta .ticket-title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
        .ticket-venta .ticket-orden { font-size: 14px; font-weight: bold; }
        .ticket-venta .ticket-fecha { font-size: 11px; margin-bottom: 6px; }
        .ticket-venta .ticket-linea { border-top: 1px dashed #888; margin: 8px 0; }
        .ticket-venta .ticket-cliente-info { text-align: left; font-size: 12px; }
        .ticket-venta .ticket-producto { margin-bottom: 6px; }
        .ticket-venta .ticket-producto-nombre { font-weight: bold; overflow-wrap: break-word; }
        .ticket-venta .ticket-producto-detalle { display: flex; justify-content: space-between; }
        .ticket-venta .ticket-summary-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
        .ticket-venta .ticket-pendente { background: #f0f0f0; padding: 4px; border: 1px solid #ddd; }
        .ticket-venta .ticket-notes { text-align: left; font-size: 11px; }
        .ticket-venta .ticket-footer { 
            text-align: center; 
            font-size: 10px; 
            margin-top: 10px; 
            line-height: 1.4; 
            padding-bottom: 20px !important;
        }
        
        /* ===== SECCIÃ“N FACTURACIÃ“N: Contener dentro del ancho ===== */
        .ticket-billing-section {
            box-sizing: border-box !important;
            max-width: 100% !important;
            overflow: hidden;
            word-break: break-word;
        }
        
        /* ===== IMÃGENES & MEDIA ===== */
        img { max-width: 100% !important; height: auto; display: block; }
        svg { max-width: 100% !important; height: auto; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        td, th { vertical-align: top; overflow-wrap: break-word; word-wrap: break-word; }
        hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
        
        /* ===== PRINT MEDIA ===== */
        @media print {
            @page { margin: 0 !important; size: ${width}mm auto; }
            html, body { 
                margin: 0 !important; 
                padding: 0 !important; 
                width: ${width}mm;
            }
            .ticket-venta { 
                width: 100% !important; 
                overflow: visible !important;
                padding-bottom: 30px !important; 
            }
        }
    </style>
</head>
<body>
    ${ticketInnerHtml}
</body>
</html>`;
    },

    /**
     * Asegura que un HTML string tenga charset UTF-8 y estilos de impresiÃ³n
     */
    ensureHtmlCharset(html) {
        if (!html.includes('charset')) {
            html = html.replace('<head>', '<head><meta charset="UTF-8">');
        }
        return html;
    },

    /**
     * Fallback cuando la impresiÃ³n silenciosa falla o no estÃ¡ disponible
     */
    fallbackPrint(htmlContent) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            console.error('[PrintService] No se pudo abrir ventana de impresiÃ³n (popup bloqueado)');
            return;
        }
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    },

    /**
     * Genera el HTML bÃ¡sico para un ticket (Ticket de Venta)
     * Mantenido por compatibilidad con flujos que no usan el componente React
     */
    generateTicketHtml(businessData, orderData, items) {
        const width = businessData.printer_width || 80;
        const fontSize = businessData.printer_font_size || 12;
        const fontFamily = businessData.printer_font_family || "'Courier New', Courier, monospace";
        const fontWeight = businessData.printer_is_bold ? 'bold' : 'normal';

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: ${fontFamily}; 
            width: ${width}mm;
            max-width: 100%;
            margin: 0; 
            padding: ${businessData.printer_margin || 0}px;
            font-size: ${fontSize}px;
            font-weight: ${fontWeight};
            overflow: hidden;
            word-wrap: break-word;
            -webkit-print-color-adjust: exact;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        td, th { vertical-align: top; overflow-wrap: break-word; word-wrap: break-word; }
        .header-logo { max-width: 50mm; display: block; margin: 0 auto 10px; }
        @page { margin: 0; size: ${width}mm auto; }
    </style>
</head>
<body>
    <div class="text-center">
        ${businessData.logo_url ? `<img src="${businessData.logo_url}" class="header-logo">` : ''}
        <div class="bold">${businessData.name || 'LAVANDERÃA'}</div>
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
        ${businessData.ticket_message || 'Â¡Gracias por su preferencia!'}
    </div>
    <hr>
    ${businessData.enable_billing_system ? `
    <div class="text-center" style="font-size: 10px;">
        <div class="bold">FACTURACIÃ“N ELECTRÃ“NICA</div>
        <div>Portal: ${businessData.billing_url || 'https://pos-autofactura.vercel.app/'}</div>
        <div style="margin-top: 4px;">Ticket: ${orderData.ticket_uuid || 'N/A'}</div>
        <div class="bold">PIN: ${orderData.pin_facturacion || 'N/A'}</div>
        <div style="font-size: 8px; margin-top: 4px;">Facture antes del fin de mes en curso</div>
    </div>
    ` : ''}
</body>
</html>`;
    }
};


