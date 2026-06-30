-- Normalize invitation codes and keep public registration validation working.
-- The portal treats invitation codes as uppercase; this prevents manual SQL
-- inserts like 'victorchi' from becoming invisible to '/register/victorchi'.

do $$
begin
  update public.invitation_codes
  set code = upper(trim(code))
  where code is not null
    and code <> upper(trim(code));
exception
  when unique_violation then
    raise exception 'Duplicate invitation_codes exist after uppercase normalization. Merge duplicates before applying this migration.';
end $$;

create or replace function public.normalize_invitation_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.code := upper(trim(new.code));
  return new;
end;
$$;

drop trigger if exists normalize_invitation_code_before_write on public.invitation_codes;

create trigger normalize_invitation_code_before_write
before insert or update of code on public.invitation_codes
for each row
execute function public.normalize_invitation_code();

alter table public.invitation_codes enable row level security;

drop policy if exists "Anyone can read invitation codes for validation" on public.invitation_codes;
drop policy if exists "Authenticated users can mark codes as used" on public.invitation_codes;
drop policy if exists "Anyone can create invitation codes" on public.invitation_codes;
drop policy if exists "Public can validate invitation codes" on public.invitation_codes;
drop policy if exists "Authenticated users can consume invitation codes" on public.invitation_codes;

create policy "Public can validate invitation codes"
on public.invitation_codes
for select
to anon, authenticated
using (true);

create policy "Authenticated users can consume invitation codes"
on public.invitation_codes
for update
to authenticated
using (
  used = false
  and used_by is null
  and (expires_at is null or expires_at > now())
)
with check (
  used = true
  and used_by = auth.uid()
);

create or replace function public.create_invitation_code(
    p_code text,
    p_notes text,
    master_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller_id uuid;
    v_expected_pin text := '2026SOP';
    v_code text;
begin
    if master_pin is null or master_pin != v_expected_pin then
        return jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    end if;

    v_caller_id := auth.uid();
    if v_caller_id is null then
        return jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
    end if;

    if not (
        public.is_super_admin()
        or exists (
            select 1
            from public.profiles
            where id = v_caller_id
              and role = 'super_admin'
        )
    ) then
        return jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
    end if;

    v_code := upper(trim(coalesce(p_code, '')));
    if v_code = '' then
        return jsonb_build_object('success', false, 'error', 'El codigo es requerido');
    end if;

    insert into public.invitation_codes (code, notes, created_by)
    values (v_code, p_notes, 'SuperAdmin Panel');

    return jsonb_build_object(
        'success', true,
        'code', v_code,
        'message', 'Codigo de invitacion creado exitosamente'
    );

exception
    when unique_violation then
        return jsonb_build_object('success', false, 'error', 'El codigo ya existe. Intenta de nuevo.');
    when others then
        return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function public.create_invitation_code(text, text, text) from public;
grant execute on function public.create_invitation_code(text, text, text) to authenticated;