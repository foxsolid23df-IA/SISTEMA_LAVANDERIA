-- ========================================================
-- REPARACION Y PROTECCION DE IDENTIDAD MULTI-TENANT
-- ========================================================
-- Problema que corrige:
-- public.profiles.id debe ser el mismo UUID que auth.users.id.
-- Si un profile queda con un UUID distinto al usuario real de Auth, RLS bloquea
-- escrituras aunque el correo sea correcto.

create or replace function public.repair_tenant_identity(
  p_old_profile_id uuid,
  p_auth_user_id uuid
)
returns table(step text, affected_rows integer)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  t record;
  rows_changed integer;
begin
  if p_old_profile_id = p_auth_user_id then
    raise exception 'Los IDs son iguales; no hay nada que reparar.';
  end if;

  if not exists (select 1 from auth.users where id = p_auth_user_id) then
    raise exception 'No existe auth.users.id=%', p_auth_user_id;
  end if;

  if not exists (select 1 from public.profiles where id = p_old_profile_id) then
    raise exception 'No existe public.profiles.id=%', p_old_profile_id;
  end if;

  if exists (select 1 from public.profiles where id = p_auth_user_id) then
    raise exception 'Ya existe public.profiles.id=%. Fusiona esos perfiles manualmente antes de reparar.', p_auth_user_id;
  end if;

  -- Mover el perfil al ID real de Auth.
  update public.profiles
  set id = p_auth_user_id
  where id = p_old_profile_id;

  get diagnostics rows_changed = row_count;
  step := 'profiles.id';
  affected_rows := rows_changed;
  return next;

  -- Mover todas las tablas public.* que tengan user_id uuid.
  for t in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'user_id'
      and udt_name = 'uuid'
      and table_name <> 'profiles'
  loop
    execute format(
      'update %I.%I set user_id = $1 where user_id = $2',
      t.table_schema,
      t.table_name
    )
    using p_auth_user_id, p_old_profile_id;

    get diagnostics rows_changed = row_count;
    if rows_changed > 0 then
      step := format('%I.%I.user_id', t.table_schema, t.table_name);
      affected_rows := rows_changed;
      return next;
    end if;
  end loop;

  -- Mover tablas antiguas que usen store_id uuid.
  for t in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'store_id'
      and udt_name = 'uuid'
  loop
    execute format(
      'update %I.%I set store_id = $1 where store_id = $2',
      t.table_schema,
      t.table_name
    )
    using p_auth_user_id, p_old_profile_id;

    get diagnostics rows_changed = row_count;
    if rows_changed > 0 then
      step := format('%I.%I.store_id', t.table_schema, t.table_name);
      affected_rows := rows_changed;
      return next;
    end if;
  end loop;
end;
$$;

-- Ejecutar UNA SOLA VEZ para este caso:
-- select * from public.repair_tenant_identity(
--   '3be87a1b-40b2-484e-96fb-7633ae4ca174',
--   '3f060772-b6db-406f-9630-9112234e5069'
-- );

create or replace function public.prevent_orphan_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from auth.users where id = new.id) then
    raise exception 'public.profiles.id debe existir en auth.users.id. ID invalido: %', new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_orphan_profile on public.profiles;

create trigger trg_prevent_orphan_profile
before insert or update of id on public.profiles
for each row
execute function public.prevent_orphan_profile();
