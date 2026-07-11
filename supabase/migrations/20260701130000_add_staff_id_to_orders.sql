-- Migración: Agregar campos de seguimiento de empleados a la tabla orders
-- Esto permite rastrear qué empleado (cajero) creó y canceló cada orden

-- 1. Agregar la columna created_by_staff_id si no existe
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS created_by_staff_id BIGINT REFERENCES public.staff(id);

-- 2. Agregar la columna cancelled_by_staff_id si no existe (para rastrear quién canceló)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cancelled_by_staff_id BIGINT REFERENCES public.staff(id);

-- 3. Agregar índices para mejorar rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_orders_created_by_staff ON public.orders(created_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_by_staff ON public.orders(cancelled_by_staff_id);

-- Actualizar órdenes existentes para que tengan un valor por defecto NULL
-- (Las órdenes antiguas no tendrán información del cajero específico)

-- Agregar comentarios a las columnas
COMMENT ON COLUMN public.orders.created_by_staff_id IS 'ID del empleado (staff) que creó esta orden. NULL para órdenes antiguas.';
COMMENT ON COLUMN public.orders.cancelled_by_staff_id IS 'ID del empleado (staff) que canceló esta orden. NULL si no ha sido cancelada o es antigua.';
