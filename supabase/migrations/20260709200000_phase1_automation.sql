-- ========================================================
-- FASE 1: AUTOMATIZACIÓN DEL SISTEMA DE DELIVERY
-- ========================================================

-- 1. Agregar timestamp de cancelación para auditoría
ALTER TABLE public.delivery_orders
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- 2. Agregar timestamp de última notificación para recordatorios
ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;

-- 3. Agregar columna de última carga del chofer para balanceo
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS today_orders_count integer DEFAULT 0;

-- 4. Índice para buscar conversaciones abandonadas
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_abandoned
ON public.whatsapp_conversations(user_id, current_state, last_message_at)
WHERE current_state IN ('awaiting_address', 'awaiting_garments', 'awaiting_zone', 'awaiting_pickup_day');

-- 5. Índice para buscar pedidos pendientes antiguos
CREATE INDEX IF NOT EXISTS idx_delivery_orders_old_requested
ON public.delivery_orders(user_id, status, created_at)
WHERE status = 'requested';

-- 6. Función RPC para cancelar pedidos abandonados (llamada desde Edge Function)
CREATE OR REPLACE FUNCTION public.cancel_stale_orders(p_user_id uuid, p_max_age_hours integer DEFAULT 24)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cancelled_count integer := 0;
BEGIN
  UPDATE public.delivery_orders
  SET status = 'cancelled',
      cancelled_at = now()
  WHERE user_id = p_user_id
    AND status = 'requested'
    AND created_at < now() - (p_max_age_hours || ' hours')::interval
    AND pickup_quote_confirmed_at IS NULL;
  
  GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;
  RETURN v_cancelled_count;
END;
$$;

-- 7. Función RPC para contar pedidos activos de un chofer hoy
CREATE OR REPLACE FUNCTION public.get_driver_active_orders_today(p_driver_id bigint)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT count(*)::integer
  FROM public.delivery_orders
  WHERE driver_id = p_driver_id
    AND status IN ('assigned', 'accepted', 'picked_up')
    AND created_at >= (now() AT TIME ZONE 'America/Mexico_City')::date;
$$;

-- 8. Función RPC para obtener chofer con menor carga
CREATE OR REPLACE FUNCTION public.get_least_busy_driver(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT s.id
  FROM public.staff s
  WHERE s.user_id = p_user_id
    AND s.active = true
    AND s.role IN ('repartidor', 'chofer')
    AND s.phone IS NOT NULL
  ORDER BY (
    SELECT count(*)
    FROM public.delivery_orders dord
    WHERE dord.driver_id = s.id
      AND dord.status IN ('assigned', 'accepted', 'picked_up')
      AND dord.created_at >= (now() AT TIME ZONE 'America/Mexico_City')::date
  ) ASC,
  s.id ASC
  LIMIT 1;
$$;
