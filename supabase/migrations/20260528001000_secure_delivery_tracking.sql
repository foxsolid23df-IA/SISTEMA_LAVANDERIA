-- ========================================================
-- SEGUIMIENTO PUBLICO SEGURO DE DELIVERY
-- ========================================================
-- El tracking publico ahora se consulta mediante la Edge Function
-- get-delivery-tracking, por lo que ya no se expone lectura directa
-- anonima de public.delivery_orders.

drop policy if exists "Anyone can read order by tracking token" on public.delivery_orders;
