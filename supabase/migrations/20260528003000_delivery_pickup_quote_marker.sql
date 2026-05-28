-- ========================================================
-- MARCADOR DE COTIZACION DE RECOGIDA / DELIVERY
-- ========================================================
-- delivery_fee puede ser 0.00. Por eso no debe usarse el monto para saber
-- si la sucursal ya cotizo la recogida.

alter table public.delivery_orders
add column if not exists pickup_quote_confirmed_at timestamptz,
add column if not exists quote_notes text;

update public.delivery_orders
set pickup_quote_confirmed_at = coalesce(payment_preference_confirmed_at, accepted_at, created_at, now())
where pickup_quote_confirmed_at is null
  and (
    coalesce(delivery_fee, 0) > 0
    or payment_preference_confirmed_at is not null
  );
