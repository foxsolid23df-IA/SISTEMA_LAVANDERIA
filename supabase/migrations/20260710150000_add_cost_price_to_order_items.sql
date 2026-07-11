-- ============================================================
-- MIGRACIÓN: Costo histórico en order_items
-- Fecha: 2026-07-09
-- ============================================================
-- Agrega cost_price a order_items para registrar el costo
-- al momento de la venta (valor histórico, inmutable)

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.order_items.cost_price
IS 'Costo del producto al momento de la venta (para rendimiento staff)';
