import Swal from 'sweetalert2';
import { supabase } from '../supabase';

export const NOTICE_EVENTS = Object.freeze({
  OPEN_CASH: 'abrir_caja',
  CLOSE_CASH: 'cerrar_caja',
});

const isValidNoticeEvent = (eventName) => Object.values(NOTICE_EVENTS).includes(eventName);

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const openNoticeUrl = (url) => {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
};

export const noticeService = {
  async getActiveNotices(eventName) {
    if (!isValidNoticeEvent(eventName)) {
      return [];
    }

    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!user?.id) return [];

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('remote_notices')
        .select('id,title,message,button_text,button_url')
        .eq('user_id', user.id)
        .eq('active', true)
        .contains('events', [eventName])
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('id', { ascending: true });

      if (error) throw error;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn('[NoticeService] No se pudieron consultar avisos remotos:', error);
      return [];
    }
  },

  async showNotice(notice) {
    if (!notice?.message) return false;

    const hasButton = Boolean(notice.button_text && notice.button_url);
    const result = await Swal.fire({
      title: notice.title || 'Aviso',
      html: `<div style="text-align: left; line-height: 1.55; color: #334155;">${escapeHtml(notice.message).replace(/\n/g, '<br/>')}</div>`,
      icon: 'info',
      showCancelButton: hasButton,
      confirmButtonText: hasButton ? notice.button_text : 'Entendido',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      allowOutsideClick: true,
    });

    if (hasButton && result.isConfirmed) {
      openNoticeUrl(notice.button_url);
    }

    return true;
  },

  async showNoticesForEvent(eventName) {
    try {
      const notices = await this.getActiveNotices(eventName);
      for (const notice of notices) {
        await this.showNotice(notice);
      }
      return notices;
    } catch (error) {
      console.warn('[NoticeService] Error mostrando avisos remotos:', error);
      return [];
    }
  },
};
