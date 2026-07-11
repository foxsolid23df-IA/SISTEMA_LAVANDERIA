-- ============================================================
-- MIGRACIÓN: Rendimiento de Staff (Producción por Empleado)
-- Fecha: 2026-07-10
-- ============================================================
-- Agrega: feature flag + columna staff_id en order_items
-- para asignar cada servicio a un empleado y calcular ganancia neta

-- 1. Feature flag en business_settings
ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS employee_production_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.business_settings.employee_production_enabled
IS 'Habilita módulo Rendimiento de Staff (asignación de empleados + ganancia neta)';

-- 2. Columna staff_id en order_items (empleado que procesa el servicio)
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS staff_id BIGINT REFERENCES public.staff(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.order_items.staff_id
IS 'Empleado asignado para procesar este servicio (Rendimiento de Staff)';

-- 3. Índice para consultas de rendimiento
CREATE INDEX IF NOT EXISTS idx_order_items_staff_id
ON public.order_items(staff_id)
WHERE staff_id IS NOT NULL;
