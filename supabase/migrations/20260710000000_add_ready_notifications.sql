-- ========================================================
-- MIGRACION: NOTIFICACIONES WHATSAPP PARA ORDENES LISTAS
-- ========================================================
-- Agrega campos a orders para tracking de recordatorios
-- y campos a business_settings para toggle + plantillas

-- 1. Agregar columnas a public.orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS ready_reminder_stage TEXT DEFAULT NULL;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS last_ready_reminder_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.orders.ready_at IS 'Fecha/hora cuando la orden fue marcada como Lista para entrega';
COMMENT ON COLUMN public.orders.ready_reminder_stage IS 'Etapa del recordatorio: null, first, second, third';
COMMENT ON COLUMN public.orders.last_ready_reminder_at IS 'Fecha/hora del ultimo recordatorio enviado';

CREATE INDEX IF NOT EXISTS idx_orders_ready_reminder
ON public.orders (status, ready_at)
WHERE status = 'ready' AND ready_at IS NOT NULL AND deleted_at IS NULL;

-- 2. Agregar columnas a public.business_settings
ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS ready_notifications_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS ready_msg_template_1 TEXT;

ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS ready_msg_template_2 TEXT;

ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS ready_msg_template_3 TEXT;

COMMENT ON COLUMN public.business_settings.ready_notifications_enabled IS 'Habilita notificaciones WhatsApp automaticas cuando una orden se marca como Lista';
COMMENT ON COLUMN public.business_settings.ready_msg_template_1 IS 'Plantilla mensaje inmediato (ropa lista). Variables: {customer_name}, {store_name}, {order_folio}';
COMMENT ON COLUMN public.business_settings.ready_msg_template_2 IS 'Plantilla recordatorio 24h. Variables: {customer_name}, {store_name}, {order_folio}';
COMMENT ON COLUMN public.business_settings.ready_msg_template_3 IS 'Plantilla aviso final 72h. Variables: {customer_name}, {store_name}, {order_folio}';
