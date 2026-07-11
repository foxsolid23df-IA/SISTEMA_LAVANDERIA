-- Agregar assigned_staff_id para encargado por orden (Rendimiento de Staff)
-- Permite asignar un empleado responsable de toda la orden en lugar de por ítem

-- 1. Agregar columna assigned_staff_id en orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS assigned_staff_id BIGINT REFERENCES public.staff(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.orders.assigned_staff_id
IS 'ID del empleado (staff) responsable de esta orden. Usado en Rendimiento de Staff.';

-- 2. Índice para consultas por encargado
CREATE INDEX IF NOT EXISTS idx_orders_assigned_staff_id
ON public.orders(assigned_staff_id)
WHERE assigned_staff_id IS NOT NULL;
