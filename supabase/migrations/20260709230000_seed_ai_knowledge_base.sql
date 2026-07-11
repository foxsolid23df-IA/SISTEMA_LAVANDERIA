-- Seed: Insert default knowledge base entries for ALL existing stores
-- Date: 2026-07-09

DO $$
DECLARE
  store_record RECORD;
BEGIN
  FOR store_record IN SELECT id FROM profiles LOOP
    INSERT INTO ai_knowledge_base (store_id, category, question, answer, sort_order) VALUES
    (store_record.id, 'horarios', '¿Qué horas abren?', 'Nuestro horario es de lunes a sábado de 8am a 6pm. Domingos estamos cerrados.', 1),
    (store_record.id, 'horarios', '¿Abren domingos?', 'No, los domingos estamos cerrados. Nuestro horario es de lunes a sábado de 8am a 6pm.', 2),
    (store_record.id, 'horarios', '¿Cierran festivos?', 'Los días festivos tenemos horario especial. Te recomiendo llamar para confirmar.', 3),
    (store_record.id, 'pagos', '¿Aceptan tarjeta?', 'Sí, aceptamos efectivo, transferencia bancaria y tarjeta de débito/crédito.', 10),
    (store_record.id, 'pagos', '¿Puedo pagar después?', 'El pago se realiza al momento de la recogida o entrega de la ropa.', 11),
    (store_record.id, 'pagos', '¿Cómo pago?', 'Puedes pagar en efectivo, por transferencia bancaria o con tarjeta. El pago es al entregar tu ropa.', 12),
    (store_record.id, 'ubicacion', '¿Dónde están ubicados?', 'Estamos en la dirección de la tienda. También ofrecemos servicio a domicilio en varias zonas.', 20),
    (store_record.id, 'ubicacion', '¿Zonas de cobertura?', 'Cobrimos varias zonas de la ciudad. ¿En qué colonia estás? Puedo verificar si cubrimos tu zona.', 21),
    (store_record.id, 'ubicacion', '¿Van a mi colonia?', 'Para saber si cubrimos tu zona, por favor envíanos tu dirección o colonia y te confirmo.', 22),
    (store_record.id, 'tiempo', '¿Cuánto tarda?', 'El lavado ordinario tarda 24-48 horas. El servicio express se entrega en 4-6 horas.', 30),
    (store_record.id, 'tiempo', '¿Pueden ser para hoy?', 'El servicio express está disponible para entrega el mismo día. ¿Te interesa el servicio express?', 31),
    (store_record.id, 'tiempo', '¿En cuánto está listo?', 'Depende del servicio: ordinario 24-48 horas, express 4-6 horas. ¿Cuál prefieres?', 32),
    (store_record.id, 'proceso', '¿Cómo funciona?', 'Es muy fácil: 1) Envíanos tu dirección, 2) Recogemos tu ropa, 3) La lavamos y te la entregamos.', 40),
    (store_record.id, 'proceso', '¿Qué necesito mandar?', 'Solo necesitas enviarnos tu dirección completa o ubicación por WhatsApp.', 41),
    (store_record.id, 'proceso', '¿Cómo agendo?', 'Puedes escribir "1" para solicitar una recogida o enviarnos tu dirección directamente.', 42),
    (store_record.id, 'servicios', '¿Qué servicios tienen?', 'Ofrecemos lavado ordinario, lavado en seco, planchado, tintorería y más. ¿Te interesa algún servicio en particular?', 50),
    (store_record.id, 'servicios', '¿Hacen tintorería?', 'Sí, ofrecemos servicio de tintorería para prendas delicadas que requieren cuidado especial.', 51),
    (store_record.id, 'servicios', '¿Planchan?', 'Sí, ofrecemos servicio de planchado. Puedes agregarlo a tu pedido de lavado.', 52),
    (store_record.id, 'problemas', 'Mi ropa salió mal', 'Lamento mucho escuchar eso. Por favor escribe "4" para hablar con atención al cliente y resolver tu problema.', 60),
    (store_record.id, 'problemas', 'No llegó a tiempo', 'Disculpa la demora. Por favor escribe "4" para que podamos revisar tu caso y darte una solución.', 61),
    (store_record.id, 'problemas', 'Perdieron mi prenda', 'Lamento mucho esa situación. Por favor escribe "4" para hablar con atención al cliente y resolver esto.', 62);
  END LOOP;
END $$;
