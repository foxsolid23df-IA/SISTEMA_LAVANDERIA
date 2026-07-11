-- ============================================================
-- Migración: Columnas extras para pagos y cotización automática
-- Fecha: 2026-07-08
-- ============================================================

-- 1. Columnas extras en delivery_payments
ALTER TABLE public.delivery_payments
ADD COLUMN IF NOT EXISTS proof_photo_path text,
ADD COLUMN IF NOT EXISTS registered_at timestamptz;

-- 2. Columna auto_quoted en delivery_orders
ALTER TABLE public.delivery_orders
ADD COLUMN IF NOT EXISTS auto_quoted boolean NOT NULL DEFAULT false;

-- 3. Actualizar CHECK constraint de whatsapp_conversations para incluir nuevos estados
ALTER TABLE whatsapp_conversations DROP CONSTRAINT IF EXISTS whatsapp_conversations_current_state_check;

ALTER TABLE whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_current_state_check
  CHECK (current_state IN (
    'idle',
    'awaiting_address',
    'awaiting_garments',
    'awaiting_tracking',
    'awaiting_client_approval',
    'awaiting_payment_preference',
    'agent_mode'
  ));
