  -- ============================================================
  -- Migración: Chatbot Conversacional + Config Mejorada de WhatsApp
  -- Fecha: 2026-07-07
  -- ============================================================

  -- 1. Nuevas columnas en profiles para chatbot y configuración
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_chatbot_enabled boolean DEFAULT false;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_instance_status text DEFAULT 'unknown';

  -- Plantillas de respuestas automáticas del chatbot (JSON editable por tienda)
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_auto_replies jsonb DEFAULT '{
    "welcome": "Hola {nombre}! Bienvenido a *{tienda}*.\n\n¿Qué deseas hacer?\n\n1️⃣ Solicitar recogida de ropa\n2️⃣ Consultar mi pedido\n3️⃣ Hablar con atención al cliente",
    "menu_pickup": "Perfecto {nombre}. Por favor envíanos tu dirección o ubicación por WhatsApp para programar la recogida de tu ropa.",
    "menu_tracking": "Envía tu número de folio o el enlace de tracking que recibiste por WhatsApp y te diremos el estatus de tu pedido.",
    "menu_agent": "Un momento por favor, te comunicamos con atención al cliente. 🕐",
    "no_address": "Hola {nombre}! Para solicitar la recogida necesitamos tu dirección completa.\n\nPuedes enviarnos:\n📍 Tu ubicación por WhatsApp\n📝 O escribir: Calle 10 #123, Colonia Centro",
    "order_confirmed": "¡Gracias {nombre}! Hemos recibido tu solicitud para recoger tu ropa en *{tienda}*.\n\n📍 Dirección: {direccion}\n🔗 Sigue tu pedido: {tracking_url}",
    "tracking_found": "*{tienda}*: Tu pedido #{folio} tiene estatus: *{estatus}*.\n\nSigue el detalle en vivo: {tracking_url}",
    "tracking_not_found": "No encontramos un pedido con ese folio o enlace. Verifica el número e intenta de nuevo.",
    "disabled": "Hola {nombre}! Por el momento *{tienda}* no tiene activo el servicio de recogida a domicilio por WhatsApp. Por favor contacta directamente a la sucursal.",
    "fallback": "Hola {nombre}! Bienvenido a *{tienda}*.\n\nPara solicitar recogida de ropa, envía tu dirección o ubicación.\nSi necesitas otra cosa, escribe *menu* para ver las opciones."
  }'::jsonb;

  -- 2. Tabla de conversaciones de WhatsApp (estado por cliente)
  CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    customer_phone text NOT NULL,
    customer_name text DEFAULT 'Cliente',
    current_state text DEFAULT 'idle'
      CHECK (current_state IN ('idle', 'awaiting_address', 'awaiting_tracking', 'agent_mode')),
    last_message_at timestamptz DEFAULT now(),
    context jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );

  -- RLS: cada tienda ve solo sus conversaciones
  ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Stores can manage own conversations"
    ON whatsapp_conversations FOR ALL
    USING (auth.uid() = user_id);

  -- Índice para búsqueda rápida por teléfono + tienda
  CREATE INDEX IF NOT EXISTS idx_conversations_phone
    ON whatsapp_conversations(user_id, customer_phone);

  -- Índice por estado para limpieza de conversaciones antiguas
  CREATE INDEX IF NOT EXISTS idx_conversations_state
    ON whatsapp_conversations(user_id, current_state);

  -- 3. Función para limpiar conversaciones abandonadas (>24h sin actividad)
  CREATE OR REPLACE FUNCTION cleanup_stale_conversations()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  BEGIN
    DELETE FROM whatsapp_conversations
    WHERE updated_at < now() - interval '24 hours'
      AND current_state = 'idle';
  END;
  $$;

  -- 4. Vista para dashboard de conversaciones activas (opcional, para admin)
  CREATE OR REPLACE VIEW active_whatsapp_conversations AS
  SELECT
    wc.id,
    wc.user_id,
    wc.customer_phone,
    wc.customer_name,
    wc.current_state,
    wc.last_message_at,
    wc.context,
    p.store_name
  FROM whatsapp_conversations wc
  JOIN profiles p ON p.id = wc.user_id
  WHERE wc.current_state != 'idle'
    AND wc.updated_at > now() - interval '24 hours'
  ORDER BY wc.last_message_at DESC;
