-- =============================================================
-- MIGRACIÓN: Corrección de funciones faltantes y permisos
-- =============================================================
-- Problemas corregidos:
-- 1. Crear update_license_expiry (no existía en migraciones)
-- 2. Crear toggle_super_admin_role (no existía en migraciones)
-- 3. Restaurar fallback role='super_admin' en get_admin_profiles
-- 4. Crear RPCs seguras para remote_notices con PIN Maestro
-- 5. Actualizar RLS remote_notices para incluir fallback role='super_admin'
-- =============================================================

-- ==========================================
-- 1. FUNCIÓN: update_license_expiry
-- ==========================================
DROP FUNCTION IF EXISTS public.update_license_expiry(UUID, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.update_license_expiry(
    target_user_id UUID,
    new_expiry TIMESTAMPTZ,
    master_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_expected_pin TEXT := '2026SOP';
BEGIN
    IF master_pin IS NULL OR master_pin != v_expected_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    END IF;

    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
    END IF;

    IF NOT (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = v_caller_id AND role = 'super_admin'
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
    END IF;

    UPDATE public.profiles
    SET license_expires_at = new_expiry
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente no encontrado');
    END IF;

    RETURN jsonb_build_object('success', true, 'license_expires_at', new_expiry);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_license_expiry(UUID, TIMESTAMPTZ, TEXT) TO authenticated;

-- ==========================================
-- 2. FUNCIÓN: toggle_super_admin_role
-- ==========================================
DROP FUNCTION IF EXISTS public.toggle_super_admin_role(UUID, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.toggle_super_admin_role(
    target_user_id UUID,
    make_admin BOOLEAN,
    master_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_expected_pin TEXT := '2026SOP';
BEGIN
    IF master_pin IS NULL OR master_pin != v_expected_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    END IF;

    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
    END IF;

    IF NOT (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = v_caller_id AND role = 'super_admin'
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
    END IF;

    IF target_user_id = v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'No puedes cambiar tu propio rol');
    END IF;

    UPDATE public.profiles
    SET role = CASE WHEN make_admin THEN 'super_admin' ELSE 'admin' END
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente no encontrado');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_role', CASE WHEN make_admin THEN 'super_admin' ELSE 'admin' END
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_super_admin_role(UUID, BOOLEAN, TEXT) TO authenticated;

-- ==========================================
-- 3. CORREGIR get_admin_profiles: restaurar fallback role='super_admin'
-- ==========================================
DROP FUNCTION IF EXISTS public.get_admin_profiles(TEXT);

CREATE OR REPLACE FUNCTION public.get_admin_profiles(master_pin TEXT)
RETURNS TABLE(
    id UUID,
    store_name TEXT,
    full_name TEXT,
    email TEXT,
    role TEXT,
    license_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    license_type TEXT,
    delivery_enabled BOOLEAN,
    delivery_enabled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_super_admin BOOLEAN;
BEGIN
    IF master_pin IS NULL OR master_pin <> '2026SOP' THEN
        RAISE EXCEPTION 'PIN Incorrecto';
    END IF;

    SELECT
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.profiles p2
            WHERE p2.id = auth.uid() AND p2.role = 'super_admin'
        )
    INTO v_is_super_admin;

    IF COALESCE(v_is_super_admin, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Acceso Denegado';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.store_name,
        p.full_name,
        u.email::TEXT,
        p.role,
        p.license_expires_at,
        p.created_at,
        p.license_type,
        COALESCE(p.delivery_enabled, false),
        p.delivery_enabled_at
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_profiles(TEXT) TO authenticated;

-- ==========================================
-- 4. RPCs SEGURAS para remote_notices (con PIN Maestro)
-- ==========================================

-- 4a. Guardar aviso (insert o update)
CREATE OR REPLACE FUNCTION public.save_remote_notice(
    p_id BIGINT,
    p_user_id UUID,
    p_notice_key TEXT,
    p_title TEXT,
    p_message TEXT,
    p_events TEXT[],
    p_active BOOLEAN,
    p_starts_at TIMESTAMPTZ,
    p_ends_at TIMESTAMPTZ,
    p_button_text TEXT,
    p_button_url TEXT,
    master_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
    v_expected_pin TEXT := '2026SOP';
BEGIN
    IF master_pin IS NULL OR master_pin != v_expected_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    END IF;

    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
    END IF;

    IF NOT (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
    END IF;

    IF p_id IS NOT NULL THEN
        UPDATE public.remote_notices
        SET
            user_id = p_user_id,
            notice_key = p_notice_key,
            title = p_title,
            message = p_message,
            events = p_events,
            active = COALESCE(p_active, true),
            starts_at = p_starts_at,
            ends_at = p_ends_at,
            button_text = p_button_text,
            button_url = p_button_url,
            updated_at = NOW()
        WHERE id = p_id
        RETURNING jsonb_build_object(
            'success', true,
            'id', id,
            'notice_key', notice_key,
            'title', title,
            'message', message,
            'events', events,
            'active', active,
            'starts_at', starts_at,
            'ends_at', ends_at,
            'button_text', button_text,
            'button_url', button_url,
            'user_id', user_id,
            'created_at', created_at,
            'updated_at', updated_at
        ) INTO v_result;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Aviso no encontrado');
        END IF;

        RETURN v_result;
    ELSE
        INSERT INTO public.remote_notices (
            user_id, notice_key, title, message, events,
            active, starts_at, ends_at, button_text, button_url,
            created_at, updated_at
        ) VALUES (
            p_user_id, p_notice_key, p_title, p_message,
            COALESCE(p_events, '{}'),
            COALESCE(p_active, true),
            p_starts_at, p_ends_at, p_button_text, p_button_url,
            NOW(), NOW()
        )
        RETURNING jsonb_build_object(
            'success', true,
            'id', id,
            'notice_key', notice_key,
            'title', title,
            'message', message,
            'events', events,
            'active', active,
            'starts_at', starts_at,
            'ends_at', ends_at,
            'button_text', button_text,
            'button_url', button_url,
            'user_id', user_id,
            'created_at', created_at,
            'updated_at', updated_at
        ) INTO v_result;

        RETURN v_result;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_remote_notice(BIGINT, UUID, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;

-- 4b. Activar/desactivar aviso
CREATE OR REPLACE FUNCTION public.toggle_remote_notice(
    p_id BIGINT,
    p_active BOOLEAN,
    master_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
    v_expected_pin TEXT := '2026SOP';
BEGIN
    IF master_pin IS NULL OR master_pin != v_expected_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    END IF;

    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
    END IF;

    IF NOT (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
    END IF;

    UPDATE public.remote_notices
    SET active = p_active, updated_at = NOW()
    WHERE id = p_id
    RETURNING jsonb_build_object(
        'success', true,
        'id', id,
        'active', active,
        'title', title,
        'user_id', user_id,
        'updated_at', updated_at
    ) INTO v_result;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Aviso no encontrado');
    END IF;

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_remote_notice(BIGINT, BOOLEAN, TEXT) TO authenticated;

-- 4c. Eliminar aviso
CREATE OR REPLACE FUNCTION public.delete_remote_notice(
    p_id BIGINT,
    master_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expected_pin TEXT := '2026SOP';
BEGIN
    IF master_pin IS NULL OR master_pin != v_expected_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    END IF;

    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
    END IF;

    IF NOT (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
    END IF;

    DELETE FROM public.remote_notices WHERE id = p_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Aviso no encontrado');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Aviso eliminado correctamente');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_remote_notice(BIGINT, TEXT) TO authenticated;

-- ==========================================
-- 5. ACTUALIZAR RLS remote_notices: incluir fallback role='super_admin'
-- ==========================================

DROP POLICY IF EXISTS "Super admins manage remote notices" ON public.remote_notices;

CREATE POLICY "Super admins manage remote notices"
ON public.remote_notices
FOR ALL
TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- ==========================================
-- COMENTARIOS
-- ==========================================
COMMENT ON FUNCTION public.update_license_expiry IS 'Actualiza la fecha de expiración de licencia de un cliente. Requiere PIN Maestro y rol super_admin.';
COMMENT ON FUNCTION public.toggle_super_admin_role IS 'Asciende o degrada a un usuario al rol super_admin. Requiere PIN Maestro y rol super_admin.';
COMMENT ON FUNCTION public.get_admin_profiles IS 'Obtiene perfiles de todas las tiendas. Verifica PIN Maestro y rol super_admin (incluye fallback profiles.role).';
COMMENT ON FUNCTION public.save_remote_notice IS 'Crea o actualiza un aviso remoto. Requiere PIN Maestro y rol super_admin.';
COMMENT ON FUNCTION public.toggle_remote_notice IS 'Activa o desactiva un aviso remoto. Requiere PIN Maestro y rol super_admin.';
COMMENT ON FUNCTION public.delete_remote_notice IS 'Elimina un aviso remoto. Requiere PIN Maestro y rol super_admin.';
