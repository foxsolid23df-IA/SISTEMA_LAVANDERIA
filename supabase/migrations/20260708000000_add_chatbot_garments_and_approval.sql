-- ============================================================
-- Migración: Chatbot - Estados awaiting_garments + aprobación del cliente
-- Fecha: 2026-07-08
-- ============================================================

-- 1. Actualizar CHECK constraint para nuevos estados
ALTER TABLE whatsapp_conversations DROP CONSTRAINT IF EXISTS whatsapp_conversations_current_state_check;

ALTER TABLE whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_current_state_check
  CHECK (current_state IN (
    'idle',
    'awaiting_address',
    'awaiting_garments',
    'awaiting_tracking',
    'awaiting_client_approval',
    'agent_mode'
  ));

-- 2. Agregar templates nuevos a whatsapp_auto_replies por defecto
-- (Solo actualiza si el campo tiene el valor default anterior, NO sobreescribe customizaciones)
UPDATE profiles
SET whatsapp_auto_replies = whatsapp_auto_replies || '{
  "ask_garments": "Perfecto {nombre}. Ahora dinos:\n\n*¿Qué prendas o servicios necesitas?*\n\nEjemplo:\n- 5 camisas lavado ordinario\n- 2 pantalones lavado en seco\n- 1 cobertor lavado especial",
  "order_quote": "*{tienda}*: Tu pedido #{folio} tiene el siguiente costo:\n\n📦 Recogida: ${delivery_fee}\n🧺 Servicio: ${service_cost}\n💰 *Total: ${total}*\n\n¿Aceptas? Responde *SI* o *NO*",
  "quote_sent": "Se ha enviado la cotización a {nombre}. Esperando su respuesta.",
  "order_approved": "¡Perfecto {nombre}! Tu pedido #{folio} ha sido confirmado. Pronto nos comunicaremos contigo.",
  "order_rejected": "{nombre} ha rechazado la cotización de su pedido #{folio}."
}'::jsonb
WHERE whatsapp_auto_replies IS NOT NULL
  AND whatsapp_auto_replies->>'ask_garments' IS NULL;
