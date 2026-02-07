-- ==========================================
-- FUNCIÓN RPC: Crear Código de Invitación
-- ==========================================
-- Ejecutar este script en Supabase SQL Editor
-- Permite a Super Admins crear códigos de invitación de forma segura

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
    v_expected_pin TEXT := '2026SOP'; -- PIN Maestro (mismo que en otras funciones)
    v_result JSONB;
BEGIN
    -- 1. Validar PIN Maestro
    IF master_pin IS NULL OR master_pin != v_expected_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    END IF;

    -- 2. Obtener usuario que llama
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
    END IF;

    -- 3. Verificar que el usuario es Super Admin
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_role IS NULL OR v_caller_role != 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
    END IF;

    -- 4. Insertar el código de invitación
    INSERT INTO public.invitation_codes (code, notes, created_by)
    VALUES (p_code, p_notes, 'SuperAdmin Panel');

    -- 5. Retornar éxito
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

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION create_invitation_code(TEXT, TEXT, TEXT) TO authenticated;

-- Comentario descriptivo
COMMENT ON FUNCTION create_invitation_code IS 'Crea un código de invitación de un solo uso. Requiere autenticación, rol super_admin y PIN Maestro.';
