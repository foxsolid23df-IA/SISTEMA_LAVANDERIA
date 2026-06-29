-- =============================================================
-- Fix completo del sistema de módulos Delivery en Super Admin
-- =============================================================
-- Problemas identificados y corregidos:
--
-- 1. is_super_admin() lanzaba RAISE EXCEPTION en vez de retornar false
--    cuando el email no estaba en super_admins. Esto hacía explotar
--    toggle_delivery_module con "El email X no está en super_admins"
--    antes de que el fallback OR exists(role='super_admin') se ejecutara.
--
-- 2. get_admin_profiles() no incluía delivery_enabled en el RETURNS TABLE,
--    por lo que el panel siempre mostraba "DELIVERY OFF" sin importar el DB.
--
-- 3. Desalineamiento: foxsolid23df@gmail.com e infogrupopc@gmail.com tienen
--    role='super_admin' en profiles pero no estaban en la tabla super_admins,
--    por lo que is_super_admin() los rechazaba.
-- =============================================================

-- Fix 1: is_super_admin() — retornar false, no lanzar excepción
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email text;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_uid;
  IF v_user_email IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE LOWER(email) = LOWER(v_user_email)
  );
END;
$$;

-- Fix 2: get_admin_profiles() — incluir delivery_enabled en la respuesta
DROP FUNCTION IF EXISTS public.get_admin_profiles(text);

CREATE OR REPLACE FUNCTION public.get_admin_profiles(master_pin text)
RETURNS TABLE(
  id uuid,
  store_name text,
  full_name text,
  email text,
  role text,
  license_expires_at timestamptz,
  created_at timestamptz,
  delivery_enabled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acceso Denegado';
  END IF;

  IF master_pin != '2026SOP' THEN
    RAISE EXCEPTION 'PIN Incorrecto';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.store_name,
    p.full_name,
    u.email::text,
    p.role,
    p.license_expires_at,
    p.created_at,
    coalesce(p.delivery_enabled, false) as delivery_enabled
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  ORDER BY p.created_at DESC;
END;
$$;

-- Fix 3: Sincronizar tabla super_admins con cuentas que tienen role='super_admin' en profiles
INSERT INTO public.super_admins (email)
VALUES ('foxsolid23df@gmail.com'), ('infogrupopc@gmail.com')
ON CONFLICT (email) DO NOTHING;
