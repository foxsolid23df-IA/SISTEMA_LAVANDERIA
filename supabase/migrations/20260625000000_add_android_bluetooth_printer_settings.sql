-- Persist Android POS Bluetooth printer settings per business.
alter table public.business_settings
  add column if not exists printer_connection_type text not null default 'system',
  add column if not exists printer_bluetooth_address text not null default '',
  add column if not exists printer_bluetooth_name text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_settings_printer_connection_type_check'
  ) then
    alter table public.business_settings
      add constraint business_settings_printer_connection_type_check
      check (printer_connection_type in ('system', 'bluetooth'));
  end if;
end $$;
