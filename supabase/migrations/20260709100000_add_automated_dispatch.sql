-- Agregar columna para la fecha programada de recoleccion
ALTER TABLE public.delivery_orders
ADD COLUMN scheduled_pickup_date DATE;

-- Agregar columna para el chofer por defecto en las zonas
ALTER TABLE public.pickup_zones
ADD COLUMN default_driver_id BIGINT REFERENCES public.staff(id) ON DELETE SET NULL;

-- Indice para optimizar las busquedas de cron (ordenes programadas para hoy)
CREATE INDEX IF NOT EXISTS idx_delivery_orders_scheduled_pickup_date 
ON public.delivery_orders(scheduled_pickup_date)
WHERE status = 'requested';
