-- ========================================================
-- FEATURE FLAG DELIVERY / PORTAL CHOFER POR TIENDA
-- ========================================================

alter table public.profiles
add column if not exists delivery_enabled boolean not null default false,
add column if not exists delivery_enabled_at timestamptz;

create or replace function public.get_admin_profiles(master_pin text)
returns table(
  id uuid,
  store_name text,
  full_name text,
  email text,
  role text,
  license_expires_at timestamptz,
  license_type text,
  delivery_enabled boolean,
  delivery_enabled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
begin
  if master_pin is null or master_pin <> '2026SOP' then
    raise exception 'PIN Maestro incorrecto';
  end if;

  select p.role into v_caller_role
  from public.profiles p
  where p.id = auth.uid();

  if v_caller_role is null or v_caller_role <> 'super_admin' then
    raise exception 'Se requiere rol super_admin';
  end if;

  return query
  select
    p.id,
    p.store_name,
    p.full_name,
    p.email,
    p.role,
    p.license_expires_at,
    p.license_type,
    coalesce(p.delivery_enabled, false) as delivery_enabled,
    p.delivery_enabled_at
  from public.profiles p
  order by p.created_at desc;
end;
$$;

grant execute on function public.get_admin_profiles(text) to authenticated;

create or replace function public.toggle_delivery_module(
  target_user_id uuid,
  enable_delivery boolean,
  master_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
begin
  if master_pin is null or master_pin <> '2026SOP' then
    return jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
  end if;

  select p.role into v_caller_role
  from public.profiles p
  where p.id = auth.uid();

  if v_caller_role is null or v_caller_role <> 'super_admin' then
    return jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
  end if;

  update public.profiles
  set
    delivery_enabled = enable_delivery,
    delivery_enabled_at = case
      when enable_delivery then coalesce(delivery_enabled_at, now())
      else null
    end
  where id = target_user_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Cliente no encontrado');
  end if;

  return jsonb_build_object(
    'success', true,
    'delivery_enabled', enable_delivery
  );
end;
$$;

grant execute on function public.toggle_delivery_module(uuid, boolean, text) to authenticated;
