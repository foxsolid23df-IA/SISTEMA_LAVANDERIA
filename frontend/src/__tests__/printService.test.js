import { describe, it, expect, vi, beforeEach } from 'vitest';
import { printService } from '../services/printService';

const installAndroidPrinterMock = (overrides = {}) => {
    const plugin = {
        requestBluetoothPermissions: vi.fn().mockResolvedValue({ granted: true }),
        listPairedDevices: vi.fn().mockResolvedValue({
            devices: [
                { name: 'POS-58', address: '00:11:22:33:44:55', id: '00:11:22:33:44:55' }
            ]
        }),
        printTicket: vi.fn().mockResolvedValue({ success: true }),
        ...overrides,
    };

    window.Capacitor = {
        getPlatform: () => 'android',
        Plugins: {
            PosBluetoothPrinter: plugin,
        },
    };

    return plugin;
};

describe('printService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete window.electron;
        delete window.Capacitor;
        global.fetch = vi.fn();

        if (!global.btoa) {
            global.btoa = (value) => Buffer.from(value, 'binary').toString('base64');
        }

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
        it('debe usar la API de Electron si esta disponible', async () => {
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

        it('debe listar dispositivos Bluetooth emparejados en Android Capacitor', async () => {
            const plugin = installAndroidPrinterMock();

            const printers = await printService.getPrinters();

            expect(plugin.requestBluetoothPermissions).toHaveBeenCalled();
            expect(plugin.listPairedDevices).toHaveBeenCalled();
            expect(global.fetch).not.toHaveBeenCalled();
            expect(printers).toEqual([
                expect.objectContaining({
                    name: 'POS-58',
                    address: '00:11:22:33:44:55',
                    connectionType: 'bluetooth',
                })
            ]);
        });

        it('debe hacer fetch al backend local si NO esta en Electron ni Android', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ([{ name: 'Local Printer', isDefault: false }])
            });

            const printers = await printService.getPrinters();

            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/printer/list'));
            expect(printers[0].name).toBe('Local Printer');
        });

        it('debe retornar array vacio si falla el fetch', async () => {
            global.fetch.mockRejectedValue(new Error('Network Error'));
            const printers = await printService.getPrinters();
            expect(printers).toEqual([]);
        });
    });

    describe('print', () => {
        const htmlContent = '<div>Ticket</div>';

        it('debe usar impresion nativa de Electron si esta disponible', async () => {
            window.electron = {
                printTicket: vi.fn().mockResolvedValue({ success: true })
            };

            const result = await printService.print(htmlContent);

            expect(window.electron.printTicket).toHaveBeenCalledWith(htmlContent, null);
            expect(result).toBe(true);
        });

        it('debe usar impresion ESC/POS Bluetooth en Android', async () => {
            const plugin = installAndroidPrinterMock();

            const result = await printService.print(htmlContent, null, {
                settings: {
                    printer_width: 58,
                    printer_bluetooth_address: '00:11:22:33:44:55',
                },
                ticketData: {
                    type: 'sale',
                    settings: { name: 'Lavanderia Demo', printer_width: 58 },
                    venta: {
                        folio: 'A-1',
                        total: 45,
                        productos: [
                            { name: 'Lavado', quantity: 1, price: 45, total: 45 }
                        ]
                    }
                }
            });

            expect(result).toBe(true);
            expect(plugin.printTicket).toHaveBeenCalledWith(expect.objectContaining({
                address: '00:11:22:33:44:55',
                data: expect.any(String),
            }));
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('debe usar Backend Bridge si Electron NO esta disponible', async () => {
            global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

            await printService.print(htmlContent, 'Printer1');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/printer/print'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ htmlContent, printerName: 'Printer1' })
                })
            );
        });

        it('debe usar fallbackPrint si el Backend Bridge falla', async () => {
            global.fetch.mockResolvedValue({ ok: false });
            const spyFallback = vi.spyOn(printService, 'fallbackPrint');

            const result = await printService.print(htmlContent);

            expect(spyFallback).toHaveBeenCalledWith(htmlContent);
            expect(result).toBe(true);
        });
    });
});
