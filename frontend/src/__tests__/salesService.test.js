import { describe, it, expect, vi, beforeEach } from 'vitest';
import { salesService } from '../services/salesService';
import { supabase } from '../supabase';
import { terminalService } from '../services/terminalService';

// Mocks
vi.mock('../services/terminalService', () => ({
    terminalService: {
        getTerminalId: vi.fn()
    }
}));

vi.mock('../config', () => ({
    config: {
        api: { baseUrl: 'http://localhost:3000' }
    }
}));

// Mock Global de Fetch
global.fetch = vi.fn();

// Mock Global de Navigator
Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: true
});

// Mock de Supabase
const mockQuery = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    abortSignal: vi.fn(),
    // IMPORTANTE: 'then' permite que el objeto sea "awaited" como una promesa
    then: function(resolve, reject) {
        // Por defecto resuelve a éxito vacío si se espera directamente
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    }
};

// Configuración circular para encadenamiento
Object.keys(mockQuery).forEach(key => {
    if (key !== 'then') {
        mockQuery[key].mockReturnValue(mockQuery);
    }
});

vi.mock('../supabase', () => ({
    supabase: {
        from: vi.fn(() => mockQuery),
        rpc: vi.fn(),
        auth: {
            getUser: vi.fn()
        }
    }
}));

describe('salesService', () => {
    const mockSaleData = {
        total: 100,
        items: [
            { id: 1, name: 'Prod 1', price: 50, quantity: 2, stock: 10 }
        ],
        metodoPago: 'efectivo'
    };

    const mockUser = { user: { id: 'user-123' } };
    const mockTerminalId = 'term-123';

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Restaurar implementaciones base del mock circular
        Object.keys(mockQuery).forEach(key => {
            if (key !== 'then') {
                mockQuery[key].mockReturnValue(mockQuery);
            }
        });

        // Configuración por defecto
        terminalService.getTerminalId.mockReturnValue(mockTerminalId);
        supabase.auth.getUser.mockResolvedValue({ data: mockUser });
        navigator.onLine = true;
    });

    describe('createSale', () => {
        it('debe lanzar error si no hay terminal configurada', async () => {
            terminalService.getTerminalId.mockReturnValue(null);
            await expect(salesService.createSale(mockSaleData))
                .rejects.toThrow('Terminal no configurada');
        });

        it('debe crear una venta en Supabase cuando hay conexión (Online)', async () => {
            const mockSaleCreated = { id: 100, ...mockSaleData };
            
            // Configurar respuestas específicas
            // single() es la última llamada de la cadena de crear venta
            mockQuery.single.mockResolvedValue({ data: mockSaleCreated, error: null });
            
            // rpc() para actualizar stock
            supabase.rpc.mockResolvedValue({ data: null, error: null });

            const result = await salesService.createSale(mockSaleData);

            expect(result).toEqual(mockSaleCreated);
            expect(supabase.from).toHaveBeenCalledWith('sales');
            expect(mockQuery.insert).toHaveBeenCalled();
            expect(mockQuery.single).toHaveBeenCalled();
            expect(supabase.rpc).toHaveBeenCalledWith('decrement_stock', expect.any(Object));
        });

        it('debe ir al catch y llamar a saveToLocal si Supabase falla', async () => {
            // 1. Forzar error en la llamada a Supabase
            // single() lanzará el error, simulando fallo de red o DB
            mockQuery.single.mockRejectedValue(new Error('DB Down'));

            // 2. Mockear fetch para la llamada a API local
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ 
                    id: 'local-integration', 
                    status: 'pending',
                    message: 'Guardado local'
                })
            });

            // 3. Ejecutar
            const result = await salesService.createSale(mockSaleData);

            // 4. Verificaciones
            // salesService.saveToLocal agrega offline: true al resultado
            expect(result.offline).toBe(true);
            expect(result.id).toBe('local-integration');
            expect(result.status).toBe('pending');
            
            // Verificar que fetch fue llamado con la URL y body correctos
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/sales'),
                expect.objectContaining({ 
                    method: 'POST',
                    body: expect.stringContaining('"total":100')
                })
            );
        });
    });

    describe('getStatistics', () => {
        it('debe calcular correctamente los totales', async () => {
            const mockVentas = [
                { total: 100, created_at: new Date().toISOString() }, // Hoy
                { total: 200, created_at: new Date().toISOString() }  // Hoy
            ];

            // Configurar retorno de limit (última llamada en getStatistics)
            mockQuery.limit.mockResolvedValue({ data: mockVentas, error: null });

            const stats = await salesService.getStatistics();

            expect(stats.ventasTotales).toBe(2);
            expect(stats.ingresosTotales).toBe(300);
            expect(stats.ingresosDeHoy).toBe(300);
        });
    });
});
