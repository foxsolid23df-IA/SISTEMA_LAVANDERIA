-- ============================================================
-- MIGRACIÓN: Nota de Remisión
-- Fecha: 2026-07-09
-- ============================================================
-- Agrega configuración de nota de remisión (1/4 carta 10.8x14cm)

ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS enable_remision_print BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.business_settings.enable_remision_print
IS 'Habilita impresión de Nota de Remisión (formato 10.8x14cm)';

ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS remision_copies INTEGER DEFAULT 2;

COMMENT ON COLUMN public.business_settings.remision_copies
IS 'Número de copias a imprimir de la nota de remisión (default 2)';

ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS remision_terms TEXT;

COMMENT ON COLUMN public.business_settings.remision_terms
IS 'Términos y condiciones impresos al pie de la nota de remisión';
