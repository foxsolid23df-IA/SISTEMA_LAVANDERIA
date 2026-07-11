-- ============================================================
-- Migración: Arreglar CHECK constraint de whatsapp_conversations
-- Fecha: 2026-07-08
-- ============================================================

ALTER TABLE whatsapp_conversations DROP CONSTRAINT IF EXISTS whatsapp_conversations_current_state_check;

ALTER TABLE whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_current_state_check
  CHECK (current_state IN (
    'idle',
    'awaiting_address',
    'awaiting_zone',
    'awaiting_pickup_day',
    'awaiting_garments',
    'awaiting_tracking',
    'awaiting_client_approval',
    'awaiting_payment_preference',
    'agent_mode'
  ));
