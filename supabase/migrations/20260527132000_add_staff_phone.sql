-- ========================================================
-- TELEFONO DE EMPLEADOS PARA NOTIFICACIONES DE DELIVERY
-- ========================================================

alter table public.staff
add column if not exists phone text;
