-- Normalizar teléfonos existentes: eliminar todoexcepto dígitos
-- Esto asegura consistencia entre POS y app chofer

UPDATE customers
SET phone = regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone ~ '[^0-9]';

-- Comentar la columna para documentar la convención
COMMENT ON COLUMN customers.phone IS 'Teléfono del cliente, solo dígitos (sin paréntesis, guiones ni espacios)';
