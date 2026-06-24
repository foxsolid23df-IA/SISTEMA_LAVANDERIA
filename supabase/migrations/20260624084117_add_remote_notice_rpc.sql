create or replace function public.get_active_remote_notices(p_event text)
returns table (
  id bigint,
  title text,
  message text,
  button_text text,
  button_url text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    rn.id,
    rn.title,
    rn.message,
    rn.button_text,
    rn.button_url
  from public.remote_notices rn
  where (select auth.uid()) is not null
    and rn.user_id = (select auth.uid())
    and rn.active = true
    and p_event in ('abrir_caja', 'cerrar_caja')
    and rn.events @> array[p_event]::text[]
    and (rn.starts_at is null or rn.starts_at <= now())
    and (rn.ends_at is null or rn.ends_at >= now())
  order by rn.id asc;
$$;

revoke all on function public.get_active_remote_notices(text) from public;
grant execute on function public.get_active_remote_notices(text) to authenticated;
