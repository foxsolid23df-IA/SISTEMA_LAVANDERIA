-- ==========================================
-- FUNCIONES RPC: Reset Password y Validación Super Admin
-- ==========================================
-- Ejecutar en Supabase SQL Editor

-- 1. FUNCIÓN: Validar Super Admin
-- Valida que el usuario actual sea super_admin y que el PIN sea correcto
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
    -- Validar PIN
    IF master_pin IS NULL OR master_pin != v_expected_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    END IF;

    -- Obtener usuario
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
    END IF;

    -- Verificar rol
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_role IS NULL OR v_caller_role != 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION validate_super_admin(TEXT) TO authenticated;

-- 2. TRIGGER: Crear perfil vacío automáticamente al registrar usuario
-- Esto asegura que cada nuevo usuario tenga su propio perfil LIMPIO

-- Primero, la función que se ejecutará con el trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insertar un perfil VACÍO para el nuevo usuario
    -- Los datos vienen del metadata del signup
    INSERT INTO public.profiles (
        id, 
        full_name, 
        store_name, 
        role,
        license_expires_at  -- Dar 14 días de prueba por defecto
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'store_name', ''),
        'admin',
        NOW() + INTERVAL '14 days'  -- 14 días de prueba gratuita
    );
    
    RETURN NEW;
EXCEPTION WHEN unique_violation THEN
    -- Si el perfil ya existe, no hacer nada (evitar errores)
    RETURN NEW;
WHEN OTHERS THEN
    -- Logear error pero no fallar el registro
    RAISE WARNING 'Error creando perfil para usuario %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Crear el trigger (eliminar si existe primero)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- 3. IMPORTANTE: Política para permitir al service_role crear perfiles
-- (El trigger usa SECURITY DEFINER así que debería funcionar)

-- Verificar que la política de insert existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile'
    ) THEN
        CREATE POLICY "Users can insert own profile" ON public.profiles
            FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END
$$;

-- 4. Comentarios
COMMENT ON FUNCTION handle_new_user IS 'Trigger que crea un perfil LIMPIO para cada nuevo usuario registrado. Extrae full_name y store_name del metadata del signup.';
COMMENT ON FUNCTION validate_super_admin IS 'Valida que el usuario actual sea super_admin con PIN Maestro correcto.';
