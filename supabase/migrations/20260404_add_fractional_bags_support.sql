-- ==========================================
-- SCRIPT: SOPORTE PARA BOLSAS FRACCIONALES
-- ==========================================
-- Descripción: Agrega el campo 'is_fractional' a la tabla supplies
-- para indicar que un insumo (como rollos de bolsa) se consume
-- en fracciones visuales (1/4, 1/2, 3/4, 1 entero) y el sistema
-- convierte automáticamente a gramos usando content_per_presentation.

ALTER TABLE public.supplies
ADD COLUMN IF NOT EXISTS is_fractional BOOLEAN DEFAULT FALSE;

-- Opcional: Si ya se conocen los insumos tipo bolsa, se pueden marcar automáticamente
-- UPDATE public.supplies SET is_fractional = TRUE WHERE name ILIKE '%bolsa%';
