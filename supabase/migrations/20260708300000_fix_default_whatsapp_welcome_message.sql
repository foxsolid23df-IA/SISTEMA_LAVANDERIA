-- ============================================================
-- Migración: Actualizar el mensaje de bienvenida por defecto de WhatsApp Chatbot
-- Fecha: 2026-07-08
-- ============================================================

-- 1. Actualizar el valor por defecto de la columna whatsapp_auto_replies en profiles
-- para que incluya la opción "Ver lista de precios" y el menú completo de 4 opciones.
ALTER TABLE profiles ALTER COLUMN whatsapp_auto_replies SET DEFAULT '{
  "welcome": "Hola {nombre}! Bienvenido a *{tienda}*.\n\n¿Qué deseas hacer?\n\n1️⃣ Solicitar recogida de ropa\n2️⃣ Ver lista de precios\n3️⃣ Consultar mi pedido\n4️⃣ Hablar con atención al cliente",
  "menu_pickup": "Perfecto {nombre}. Por favor envíanos tu dirección o ubicación por WhatsApp para programar la recogida de tu ropa.",
  "menu_tracking": "Envía tu número de folio o el enlace de tracking que recibiste por WhatsApp y te diremos el estatus de tu pedido.",
  "menu_agent": "Un momento por favor, te comunicamos con atención al cliente. 🕐",
  "no_address": "Hola {nombre}! Para solicitar la recogida necesitamos tu dirección completa.\n\nPuedes enviarnos:\n📍 Tu ubicación por WhatsApp\n📝 O escribir: Calle 10 #123, Colonia Centro",
  "order_confirmed": "¡Gracias {nombre}! Hemos recibido tu solicitud para recoger tu ropa en *{tienda}*.\n\n📍 Dirección: {direccion}\n🔗 Sigue tu pedido: {tracking_url}",
  "tracking_found": "*{tienda}*: Tu pedido #{folio} tiene estatus: *{estatus}*.\n\nSigue el detalle en vivo: {tracking_url}",
  "tracking_not_found": "No encontramos un pedido con ese folio o enlace. Verifica el número e intenta de nuevo.",
  "disabled": "Hola {nombre}! Por el momento *{tienda}* no tiene activo el servicio de recogida a domicilio por WhatsApp. Por favor contacta directamente a la sucursal.",
  "fallback": "Hola {nombre}! Bienvenido a *{tienda}*.\n\nPara solicitar recogida de ropa, envía tu dirección o ubicación.\nSi necesitas otra cosa, escribe *menu* para ver las opciones.",
  "ask_garments": "Perfecto {nombre}. Ahora dinos:\n\n*¿Qué prendas o servicios necesitas?*\n\nEjemplo:\n- 5 camisas lavado ordinario\n- 2 pantalones lavado en seco\n- 1 cobertor lavado especial",
  "order_quote": "*{tienda}*: Tu pedido #{folio} tiene el siguiente costo:\n\n📦 Recogida: ${delivery_fee}\n🧺 Servicio: ${service_cost}\n💰 *Total: ${total}*\n\n¿Aceptas? Responde *SI* o *NO*",
  "quote_sent": "Se ha enviado la cotización a {nombre}. Esperando su respuesta.",
  "order_approved": "¡Perfecto {nombre}! Tu pedido #{folio} ha sido confirmado. Pronto nos comunicaremos contigo.",
  "order_rejected": "{nombre} ha rechazado la cotización de su pedido #{folio}."
}'::jsonb;

-- 2. Actualizar los perfiles existentes que tengan el menú antiguo de 3 opciones
-- para migrar su mensaje de bienvenida al nuevo de 4 opciones.
UPDATE profiles
SET whatsapp_auto_replies = jsonb_set(
  whatsapp_auto_replies,
  '{welcome}',
  '"Hola {nombre}! Bienvenido a *{tienda}*.\n\n¿Qué deseas hacer?\n\n1️⃣ Solicitar recogida de ropa\n2️⃣ Ver lista de precios\n3️⃣ Consultar mi pedido\n4️⃣ Hablar con atención al cliente"'::jsonb
)
WHERE whatsapp_auto_replies IS NOT NULL
  AND (
    whatsapp_auto_replies->>'welcome' NOT LIKE '%lista de precios%'
    AND whatsapp_auto_replies->>'welcome' NOT LIKE '%Ver precios%'
  );
