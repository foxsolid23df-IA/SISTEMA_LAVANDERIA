-- Migration: Create AI Knowledge Base table
-- Date: 2026-07-09
-- Description: Tabla para almacenar preguntas frecuentes y respuestas para el chatbot IA

-- Create the ai_knowledge_base table
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('horarios', 'pagos', 'ubicacion', 'tiempo', 'servicios', 'proceso', 'faq', 'problemas')),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_store_id ON ai_knowledge_base(store_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_category ON ai_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_is_active ON ai_knowledge_base(is_active);

-- Enable Row Level Security
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Users can only see their own store's knowledge base
CREATE POLICY "Users can view own store knowledge base" ON ai_knowledge_base
  FOR SELECT USING (auth.uid() = store_id);

-- Policy: Users can insert into their own store's knowledge base
CREATE POLICY "Users can insert into own store knowledge base" ON ai_knowledge_base
  FOR INSERT WITH CHECK (auth.uid() = store_id);

-- Policy: Users can update their own store's knowledge base
CREATE POLICY "Users can update own store knowledge base" ON ai_knowledge_base
  FOR UPDATE USING (auth.uid() = store_id);

-- Policy: Users can delete from their own store's knowledge base
CREATE POLICY "Users can delete from own store knowledge base" ON ai_knowledge_base
  FOR DELETE USING (auth.uid() = store_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_ai_knowledge_base_updated_at
  BEFORE UPDATE ON ai_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_knowledge_base_updated_at();

-- Insert default knowledge base entries for new stores
-- This will be triggered when a new profile is created
CREATE OR REPLACE FUNCTION create_default_ai_knowledge_base()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default FAQ entries
  INSERT INTO ai_knowledge_base (store_id, category, question, answer, sort_order) VALUES
  -- Horarios
  (NEW.id, 'horarios', '¿Qué horas abren?', 'Nuestro horario es de lunes a sábado de 8am a 6pm. Domingos estamos cerrados.', 1),
  (NEW.id, 'horarios', '¿Abren domingos?', 'No, los domingos estamos cerrados. Nuestro horario es de lunes a sábado de 8am a 6pm.', 2),
  (NEW.id, 'horarios', '¿Cierran festivos?', 'Los días festivos tenemos horario especial. Te recomiendo llamar para confirmar.', 3),
  
  -- Pagos
  (NEW.id, 'pagos', '¿Aceptan tarjeta?', 'Sí, aceptamos efectivo, transferencia bancaria y tarjeta de débito/crédito.', 10),
  (NEW.id, 'pagos', '¿Puedo pagar después?', 'El pago se realiza al momento de la recogida o entrega de la ropa.', 11),
  (NEW.id, 'pagos', '¿Cómo pago?', 'Puedes pagar en efectivo, por transferencia bancaria o con tarjeta. El pago es al entregar tu ropa.', 12),
  
  -- Ubicación
  (NEW.id, 'ubicacion', '¿Dónde están ubicados?', 'Estamos en [Dirección de la tienda]. También ofrecemos servicio a domicilio en varias zonas.', 20),
  (NEW.id, 'ubicacion', '¿Zonas de cobertura?', 'Cobrimos varias zonas de la ciudad. ¿En qué colonia estás? Puedo verificar si cubrimos tu zona.', 21),
  (NEW.id, 'ubicacion', '¿Van a mi colonia?', 'Para saber si cubrimos tu zona, por favor envíanos tu dirección o colonia y te confirmo.', 22),
  
  -- Tiempo
  (NEW.id, 'tiempo', '¿Cuánto tarda?', 'El lavado ordinario tarda 24-48 horas. El servicio express se entrega en 4-6 horas.', 30),
  (NEW.id, 'tiempo', '¿Pueden ser para hoy?', 'El servicio express está disponible para entrega el mismo día. ¿Te interesa el servicio express?', 31),
  (NEW.id, 'tiempo', '¿En cuánto está listo?', 'Depende del servicio: ordinario 24-48 horas, express 4-6 horas. ¿Cuál prefieres?', 32),
  
  -- Proceso
  (NEW.id, 'proceso', '¿Cómo funciona?', 'Es muy fácil: 1) Envíanos tu dirección, 2) Recogemos tu ropa, 3) La lavamos y te la entregamos.', 40),
  (NEW.id, 'proceso', '¿Qué necesito mandar?', 'Solo necesitas enviarnos tu dirección completa o ubicación por WhatsApp.', 41),
  (NEW.id, 'proceso', '¿Cómo agendo?', 'Puedes escribir "1" para solicitar una recogida o enviarnos tu dirección directamente.', 42),
  
  -- Servicios
  (NEW.id, 'servicios', '¿Qué servicios tienen?', 'Ofrecemos lavado ordinario, lavado en seco, planchado, tintorería y más. ¿Te interesa algún servicio en particular?', 50),
  (NEW.id, 'servicios', '¿Hacen tintorería?', 'Sí, ofrecemos servicio de tintorería para prendas delicadas que requieren cuidado especial.', 51),
  (NEW.id, 'servicios', '¿Planchan?', 'Sí, ofrecemos servicio de planchado. Puedes agregarlo a tu pedido de lavado.', 52),
  
  -- Problemas
  (NEW.id, 'problemas', 'Mi ropa salió mal', 'Lamento mucho escuchar eso. Por favor escribe "4" para hablar con atención al cliente y resolver tu problema.', 60),
  (NEW.id, 'problemas', 'No llegó a tiempo', 'Disculpa la demora. Por favor escribe "4" para que podamos revisar tu caso y darte una solución.', 61),
  (NEW.id, 'problemas', 'Perdieron mi prenda', 'Lamento mucho esa situación. Por favor escribe "4" para hablar con atención al cliente y resolver esto.', 62);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create knowledge base for new stores
CREATE TRIGGER trigger_create_default_ai_knowledge_base
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_ai_knowledge_base();

-- Add comment to table
COMMENT ON TABLE ai_knowledge_base IS 'Base de conocimiento para el chatbot IA - Almacena preguntas frecuentes y respuestas por tienda';
COMMENT ON COLUMN ai_knowledge_base.category IS 'Categoría de la pregunta: horarios, pagos, ubicacion, tiempo, servicios, proceso, faq, problemas';
COMMENT ON COLUMN ai_knowledge_base.question IS 'Pregunta del usuario (texto exacto o patrón)';
COMMENT ON COLUMN ai_knowledge_base.answer IS 'Respuesta que debe dar la IA';
