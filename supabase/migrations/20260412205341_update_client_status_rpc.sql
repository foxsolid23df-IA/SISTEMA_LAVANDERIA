-- Migration to add update_client_status function

CREATE OR REPLACE FUNCTION update_client_status(
    target_user_id UUID,
    new_status TEXT,
    master_pin TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_super boolean;
BEGIN
    -- Verificar si el usuario actual es super_admin
    SELECT is_super_admin() INTO is_super;
    
    IF NOT is_super THEN
        -- Si no es super_admin, requiere un PIN maestro válido
        IF master_pin IS NULL OR NOT validate_master_pin(master_pin) THEN
            RETURN jsonb_build_object('success', false, 'error', 'No autorizado o PIN inválido');
        END IF;
    END IF;

    -- Actualizar el status
    UPDATE profiles
    SET 
        status = new_status,
        updated_at = NOW()
    WHERE id = target_user_id;
    
    IF FOUND THEN
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
    END IF;
END;
$$;
