-- ==========================================
-- SCRIPT CONSOLIDADO: TODAS LAS FUNCIONES DEL SUPER ADMIN
-- ==========================================
-- EJECUTAR ESTE SCRIPT COMPLETO EN SUPABASE SQL EDITOR
-- Incluye: Invitaciones, Eliminar Clientes, Validación, Trigger de Perfiles Limpios

-- ==========================================
-- 1. FUNCIÓN: Validar Super Admin
-- ==========================================
CREATE OR REPLACE FUNCTION validate_super_admin(master_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_expected_pin TEXT := '2026SOP';
BEGIN
    IF master_pin IS NULL OR master_pin != v_expected_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    END IF;

    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
    END IF;

    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_role IS NULL OR v_caller_role != 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION validate_super_admin(TEXT) TO authenticated;

-- ==========================================
-- 2. FUNCIÓN: Crear Código de Invitación
-- ==========================================
CREATE OR REPLACE FUNCTION create_invitation_code(
    p_code TEXT,
    p_notes TEXT,
    master_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_expected_pin TEXT := '2026SOP';
BEGIN
    IF master_pin IS NULL OR master_pin != v_expected_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    END IF;

    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
    END IF;

    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_role IS NULL OR v_caller_role != 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
    END IF;

    INSERT INTO public.invitation_codes (code, notes, created_by)
    VALUES (p_code, p_notes, 'SuperAdmin Panel');

    RETURN jsonb_build_object(
        'success', true,
        'code', p_code,
        'message', 'Código de invitación creado exitosamente'
    );

EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'El código ya existe. Intenta de nuevo.');
WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION create_invitation_code(TEXT, TEXT, TEXT) TO authenticated;

-- ==========================================
-- 3. FUNCIÓN: Eliminar Cliente Permanentemente
-- ==========================================
CREATE OR REPLACE FUNCTION delete_client_permanently(
    target_user_id UUID,
    master_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_expected_pin TEXT := '2026SOP';
    v_target_store TEXT;
    v_target_email TEXT;
BEGIN
    IF master_pin IS NULL OR master_pin != v_expected_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    END IF;

    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
    END IF;

    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_role IS NULL OR v_caller_role != 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
    END IF;

    IF target_user_id = v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'No puedes eliminarte a ti mismo');
    END IF;

    SELECT store_name, email INTO v_target_store, v_target_email 
    FROM public.profiles WHERE id = target_user_id;
    
    IF v_target_store IS NULL AND v_target_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente no encontrado');
    END IF;

    -- ELIMINAR EN ORDEN CORRECTO (Hijos primero, luego padres)

    -- 1. Detalle de órdenes y ventas
    BEGIN DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE user_id = target_user_id); EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE user_id = target_user_id); EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    
    -- 2. Órdenes y Ventas (referencian customers, terminals, cash_sessions)
    BEGIN DELETE FROM public.orders WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.sales WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    
    -- 3. Cortes y Sesiones de Caja (referencian terminals, staff)
    BEGIN DELETE FROM public.cash_cuts WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.cash_sessions WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;

    -- 4. Insumos (referencian products o suppliers?)
    BEGIN DELETE FROM public.supplies WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    
    -- 5. Terminales (eran referenciadas por sales, cash_*)
    BEGIN DELETE FROM public.terminals WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    
    -- 6. Productos y Clientes
    BEGIN DELETE FROM public.products WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.customers WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    
    -- 7. Personal (staff)
    BEGIN DELETE FROM public.staff WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    
    -- 8. Configuraciones
    BEGIN DELETE FROM public.store_settings WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    
    -- 9. Perfil
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- Eliminar usuario de autenticación (Liberar email)
    DELETE FROM auth.users WHERE id = target_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Cliente eliminado permanentemente',
        'deleted_store', COALESCE(v_target_store, 'Sin nombre'),
        'deleted_email', v_target_email
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION delete_client_permanently(UUID, TEXT) TO authenticated;

-- ==========================================
-- 4. TRIGGER: Crear Perfil Limpio para Nuevos Usuarios
-- ==========================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        full_name, 
        store_name, 
        role,
        license_expires_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'store_name', ''),
        'admin',
        NOW() + INTERVAL '14 days'
    );
    
    RETURN NEW;
EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
WHEN OTHERS THEN
    RAISE WARNING 'Error creando perfil para usuario %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ==========================================
-- 5. AÑADIR COLUMNA EMAIL A PROFILES (si no existe)
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'email'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
END
$$;

-- Sincronizar emails existentes
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Actualizar trigger para incluir email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        email,
        full_name, 
        store_name, 
        role,
        license_expires_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'store_name', ''),
        'admin',
        NOW() + INTERVAL '14 days'
    );
    
    RETURN NEW;
EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
WHEN OTHERS THEN
    RAISE WARNING 'Error creando perfil para usuario %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ==========================================
-- COMENTARIOS
-- ==========================================
COMMENT ON FUNCTION validate_super_admin IS 'Valida que el usuario actual sea super_admin con PIN Maestro correcto.';
COMMENT ON FUNCTION create_invitation_code IS 'Crea un código de invitación de un solo uso.';
COMMENT ON FUNCTION delete_client_permanently IS '⚠️ PELIGRO: Elimina permanentemente un cliente y TODOS sus datos.';
COMMENT ON FUNCTION handle_new_user IS 'Trigger que crea un perfil LIMPIO para cada nuevo usuario registrado.';

-- ==========================================
-- ✅ SCRIPT COMPLETADO
-- ==========================================
