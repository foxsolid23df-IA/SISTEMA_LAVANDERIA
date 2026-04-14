-- Migración: Agregar campo created_by_staff_id a la tabla orders
-- Esto permite rastrear qué empleado (cajero) creó cada orden

-- Agregar la columna created_by_staff_id si no existe
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS created_by_staff_id BIGINT REFERENCES public.staff(id);

-- Agregar índice para mejorar rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_orders_created_by_staff ON public.orders(created_by_staff_id);

-- Actualizar órdenes existentes para que tengan un valor por defecto NULL
-- (Las órdenes antiguas no tendrán información del cajero específico)

-- Agregar comentario a la columna
COMMENT ON COLUMN public.orders.created_by_staff_id IS 'ID del empleado (staff) que creó esta orden. NULL para órdenes antiguas.';
