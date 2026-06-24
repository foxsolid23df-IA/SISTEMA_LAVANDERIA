import { describe, it, expect, vi, beforeEach } from 'vitest';
import { noticeService, NOTICE_EVENTS } from '../services/noticeService';

const { mockQuery, mockFrom, mockRpc, mockGetSession, mockGetUser, mockSwalFire } = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    contains: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
  };

  Object.keys(query).forEach((key) => {
    query[key].mockReturnValue(query);
  });

  return {
    mockQuery: query,
    mockFrom: vi.fn(() => query),
    mockRpc: vi.fn(),
    mockGetSession: vi.fn(),
    mockGetUser: vi.fn(),
    mockSwalFire: vi.fn(),
  };
});

vi.mock('../supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
    },
  },
}));

vi.mock('sweetalert2', () => ({
  default: {
    fire: mockSwalFire,
  },
}));

describe('noticeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockQuery).forEach((key) => {
      mockQuery[key].mockReturnValue(mockQuery);
    });
    mockQuery.order.mockResolvedValue({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'store-123' } } } });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'store-123' } } });
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      writable: true,
      value: true,
    });
    window.open = vi.fn();
  });

  it('consulta avisos activos para el usuario y evento solicitado', async () => {
    const notice = { id: 1, title: 'Aviso', message: 'Mensaje' };
    mockRpc.mockResolvedValue({ data: [notice], error: null });

    const result = await noticeService.getActiveNotices(NOTICE_EVENTS.OPEN_CASH);

    expect(result).toEqual([notice]);
    expect(mockRpc).toHaveBeenCalledWith('get_active_remote_notices', { p_event: NOTICE_EVENTS.OPEN_CASH });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('usa getUser como respaldo si no hay sesion local', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'fallback-user' } } });

    mockRpc.mockResolvedValue({ data: null, error: new Error('RPC missing') });

    await noticeService.getActiveNotices(NOTICE_EVENTS.OPEN_CASH);

    expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'fallback-user');
  });

  it('consulta Supabase aunque el navegador reporte offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      writable: true,
      value: false,
    });

    await noticeService.getActiveNotices(NOTICE_EVENTS.OPEN_CASH);

    expect(mockRpc).toHaveBeenCalledWith('get_active_remote_notices', { p_event: NOTICE_EVENTS.OPEN_CASH });
  });

  it('no consulta Supabase si el evento no es soportado', async () => {
    const result = await noticeService.getActiveNotices('otro_evento');

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('no bloquea la operacion si Supabase falla', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('RPC down') });
    mockQuery.order.mockResolvedValue({ data: null, error: new Error('DB down') });

    const result = await noticeService.showNoticesForEvent(NOTICE_EVENTS.CLOSE_CASH);

    expect(result).toEqual([]);
    expect(mockSwalFire).not.toHaveBeenCalled();
  });

  it('abre el boton de WhatsApp cuando el usuario confirma', async () => {
    mockSwalFire.mockResolvedValue({ isConfirmed: true });

    await noticeService.showNotice({
      title: 'Licencia pr?xima a vencer',
      message: 'Hola recuerda que tu licencia esta pr?xima a vencer.',
      button_text: 'Contactar por WhatsApp',
      button_url: 'https://wa.me/5215650607108',
    });

    expect(mockSwalFire).toHaveBeenCalledWith(expect.objectContaining({
      confirmButtonText: 'Contactar por WhatsApp',
      showCancelButton: true,
    }));
    expect(window.open).toHaveBeenCalledWith(
      'https://wa.me/5215650607108',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('no muestra modales si el aviso esta inactivo, vencido o fuera de fechas en la consulta', async () => {
    mockQuery.order.mockResolvedValue({ data: [], error: null });

    const result = await noticeService.showNoticesForEvent(NOTICE_EVENTS.OPEN_CASH);

    expect(result).toEqual([]);
    expect(mockSwalFire).not.toHaveBeenCalled();
  });
});
