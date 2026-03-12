-- ==========================================
-- SCRIPT: AGREGAR PRESENTACIÓN Y CONTENIDO A INSUMOS
-- ==========================================
-- Descripción: Agrega los campos 'presentation' (Galón, Bote, etc.)
-- y 'content_per_presentation' (3.7, 1, etc.) a la tabla supplies
-- para permitir conversión automática entre unidades de compra y consumo.

-- 1. Agregar columnas a la tabla supplies
ALTER TABLE public.supplies
ADD COLUMN IF NOT EXISTS presentation TEXT DEFAULT 'Galón';

ALTER TABLE public.supplies
ADD COLUMN IF NOT EXISTS content_per_presentation DOUBLE PRECISION DEFAULT 1;

-- Nota: El campo existente 'unit_measure' pasa a representar
-- la "Unidad Base" (L, Kg, mL, Pza, etc.)
