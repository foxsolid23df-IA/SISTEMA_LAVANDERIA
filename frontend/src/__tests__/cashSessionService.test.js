import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cashSessionService } from '../services/cashSessionService';
import { supabase } from '../supabase';
import { terminalService } from '../services/terminalService';

// Mock de terminalService
vi.mock('../services/terminalService', () => ({
    terminalService: {
        getTerminalId: vi.fn()
    }
}));

// Mock de supabase
vi.mock('../supabase', () => {
    const mockQuery = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null })
    };
    return {
        supabase: {
            from: vi.fn(() => mockQuery),
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } })
            }
        }
    };
});

describe('cashSessionService', () => {
    let mockQuery;

    beforeEach(() => {
        vi.clearAllMocks();
        mockQuery = supabase.from(); // Obtener la referencia al objeto mockQuery
        mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
        mockQuery.single.mockResolvedValue({ data: null, error: null });
    });

    describe('getActiveSession', () => {
        it('debe retornar null si no hay terminal_id', async () => {
            terminalService.getTerminalId.mockReturnValue(null);
            const session = await cashSessionService.getActiveSession();
            expect(session).toBeNull();
        });

        it('debe retornar los datos de la sesión si existe una abierta', async () => {
            const mockSession = { id: 1, status: 'open', terminal_id: 'term-1' };
            terminalService.getTerminalId.mockReturnValue('term-1');
            
            mockQuery.maybeSingle.mockResolvedValue({ data: mockSession, error: null });

            const session = await cashSessionService.getActiveSession();
            expect(session).toEqual(mockSession);
            expect(supabase.from).toHaveBeenCalledWith('cash_sessions');
            expect(mockQuery.eq).toHaveBeenCalledWith('status', 'open');
            expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
        });
    });

    describe('openSession', () => {
        it('debe lanzar error si la terminal no está configurada', async () => {
            terminalService.getTerminalId.mockReturnValue(null);
            await expect(cashSessionService.openSession('Juan', 100))
                .rejects.toThrow('Terminal no configurada');
        });

        it('debe crear una sesión correctamente con los datos proporcionados', async () => {
            terminalService.getTerminalId.mockReturnValue('term-1');
            const mockData = { id: 123, staff_name: 'Juan' };
            
            mockQuery.single.mockResolvedValue({ data: mockData, error: null });

            const result = await cashSessionService.openSession('Juan', 500, 'staff-1');
            
            expect(result).toEqual(mockData);
            expect(mockQuery.insert).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    staff_name: 'Juan',
                    opening_fund: 500,
                    terminal_id: 'term-1'
                })
            ]));
        });
    });
});
