-- Habilitar tiempo real para la tabla profiles
-- Necesario para que los cambios en delivery_enabled se reflejen
-- instantáneamente en el portal del cliente sin recargar la página.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 
      from pg_publication_rel pr 
      join pg_class c on pr.prrelid = c.oid 
      join pg_namespace n on c.relnamespace = n.oid 
      where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public' 
      and c.relname = 'profiles'
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;
  end if;
end $$;
