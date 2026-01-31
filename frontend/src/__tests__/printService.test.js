import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printService } from '../services/printService';

// Mock de variables de entorno
vi.mock('../config', () => ({
    config: {
        api: { baseUrl: 'http://localhost:3001/api' }
    }
}));

describe('printService', () => {
    beforeEach(() => {
        // Limpiar mocks y globales
        vi.clearAllMocks();
        delete window.electron;
        global.fetch = vi.fn();
        
        // Mock de window.open para el fallback
        window.open = vi.fn().mockReturnValue({
            document: {
                write: vi.fn(),
                close: vi.fn()
            },
            focus: vi.fn(),
            print: vi.fn(),
            close: vi.fn()
        });
    });

    describe('getPrinters', () => {
        it('debe usar la API de Electron si está disponible', async () => {
            window.electron = {
                getPrinters: vi.fn().mockResolvedValue([
                    { name: 'Epson TM-T20', isDefault: true, status: 0 }
                ])
            };

            const printers = await printService.getPrinters();
            
            expect(window.electron.getPrinters).toHaveBeenCalled();
            expect(printers).toHaveLength(1);
            expect(printers[0].name).toBe('Epson TM-T20');
        });

        it('debe hacer fetch al backend local si NO está en Electron', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ([{ name: 'Local Printer', isDefault: false }])
            });

            const printers = await printService.getPrinters();

            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/printer/list'));
            expect(printers[0].name).toBe('Local Printer');
        });

        it('debe retornar array vacío si falla el fetch', async () => {
            global.fetch.mockRejectedValue(new Error('Network Error'));
            const printers = await printService.getPrinters();
            expect(printers).toEqual([]);
        });
    });

    describe('print', () => {
        const htmlContent = '<div>Ticket</div>';

        it('debe usar impresión nativa de Electron si está disponible', async () => {
            window.electron = {
                printTicket: vi.fn().mockResolvedValue({ success: true })
            };

            const result = await printService.print(htmlContent);
            
            expect(window.electron.printTicket).toHaveBeenCalledWith(htmlContent, null);
            expect(result).toBe(true);
        });

        it('debe usar Backend Bridge si Electron NO está disponible', async () => {
            global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

            const result = await printService.print(htmlContent, 'Printer1');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/printer/print'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ htmlContent, printerName: 'Printer1' })
                })
            );
        });

        it('debe usar fallbackPrint (browser dialog) si el Backend Bridge falla', async () => {
            // Simulamos fallo del bridge
            global.fetch.mockResolvedValue({ ok: false });
            
            // Espiamos el método fallback
            const spyFallback = vi.spyOn(printService, 'fallbackPrint');

            const result = await printService.print(htmlContent);

            expect(spyFallback).toHaveBeenCalledWith(htmlContent);
            expect(result).toBe(true); // Retorna true porque el fallback se ejecutó (aunque es fire-and-forget)
        });
    });
});
