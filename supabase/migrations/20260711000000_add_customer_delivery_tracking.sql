-- Agregar columnas de tracking de delivery a la tabla customers
-- Permite contar visitas del chofer y rastrear origen del registro

ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_visit_count integer DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_delivery_visit timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source text DEFAULT 'pos';

-- Índice para búsqueda por teléfono (optimizar lookup del chofer)
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- Comentarios de documentación
COMMENT ON COLUMN customers.delivery_visit_count IS 'Número de recolecciones express realizadas por chofer';
COMMENT ON COLUMN customers.last_delivery_visit IS 'Fecha de última visita del chofer';
COMMENT ON COLUMN customers.source IS 'Origen del registro: pos, driver, whatsapp';
