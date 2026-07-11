-- ============================================================
-- MIGRACIÓN: Feature Flags para Workflow Express
-- Fecha: 2026-07-10
-- ============================================================
-- Agrega flags por tienda para controlar acceso al workflow
-- tipo Excel (Gastos, Vista Excel de Órdenes, Catálogo Simplificado)

-- 1. Agregar columnas de feature flags a business_settings
ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS express_workflow_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS service_catalog_enabled BOOLEAN DEFAULT false;

-- 2. Comentarios
COMMENT ON COLUMN public.business_settings.express_workflow_enabled
IS 'Habilita Gastos + Vista Excel de Órdenes (workflow tipo Excel)';

COMMENT ON COLUMN public.business_settings.service_catalog_enabled
IS 'Habilita Catálogo de Servicios Simplificado (modo express)';

-- 3. Activar flags para Laundry''s Express (primer cliente express)
UPDATE public.business_settings
SET express_workflow_enabled = true,
    service_catalog_enabled = true
WHERE user_id = '49fbb06f-b00f-4db7-b34d-1a54434f3a8b';
