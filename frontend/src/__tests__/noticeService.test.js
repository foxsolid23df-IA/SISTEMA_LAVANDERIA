import { describe, it, expect, vi, beforeEach } from 'vitest';
import { noticeService, NOTICE_EVENTS } from '../services/noticeService';

const { mockQuery, mockFrom, mockGetUser, mockSwalFire } = vi.hoisted(() => {
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
    mockGetUser: vi.fn(),
    mockSwalFire: vi.fn(),
  };
});

vi.mock('../supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: {
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
    mockQuery.order.mockResolvedValue({ data: [notice], error: null });

    const result = await noticeService.getActiveNotices(NOTICE_EVENTS.OPEN_CASH);

    expect(result).toEqual([notice]);
    expect(mockFrom).toHaveBeenCalledWith('remote_notices');
    expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'store-123');
    expect(mockQuery.eq).toHaveBeenCalledWith('active', true);
    expect(mockQuery.contains).toHaveBeenCalledWith('events', [NOTICE_EVENTS.OPEN_CASH]);
    expect(mockQuery.or).toHaveBeenCalledWith(expect.stringContaining('starts_at.is.null'));
    expect(mockQuery.or).toHaveBeenCalledWith(expect.stringContaining('ends_at.is.null'));
  });

  it('consulta Supabase aunque el navegador reporte offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      writable: true,
      value: false,
    });

    await noticeService.getActiveNotices(NOTICE_EVENTS.OPEN_CASH);

    expect(mockFrom).toHaveBeenCalledWith('remote_notices');
  });

  it('no consulta Supabase si el evento no es soportado', async () => {
    const result = await noticeService.getActiveNotices('otro_evento');

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('no bloquea la operacion si Supabase falla', async () => {
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
