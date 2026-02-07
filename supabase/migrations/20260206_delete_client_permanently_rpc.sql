-- ==========================================
-- FUNCIÓN RPC: Eliminar Cliente Permanentemente
-- ==========================================
-- ⚠️ PELIGRO: Esta función elimina TODOS los datos de un cliente
-- Ejecutar en Supabase SQL Editor

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
    v_expected_pin TEXT := '2026SOP'; -- PIN Maestro
    v_target_store TEXT;
    v_target_email TEXT;
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

    -- 4. Evitar auto-eliminación
    IF target_user_id = v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'No puedes eliminarte a ti mismo');
    END IF;

    -- 5. Obtener datos del cliente antes de eliminar (para log)
    SELECT store_name, email INTO v_target_store, v_target_email 
    FROM public.profiles WHERE id = target_user_id;
    
    IF v_target_store IS NULL AND v_target_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente no encontrado');
    END IF;

    -- 6. ELIMINAR EN CASCADA (orden importante por foreign keys)
    
    -- 6.1 Eliminar items de órdenes del cliente
    DELETE FROM public.order_items WHERE order_id IN (
        SELECT id FROM public.orders WHERE store_id = target_user_id
    );
    
    -- 6.2 Eliminar órdenes del cliente
    DELETE FROM public.orders WHERE store_id = target_user_id;
    
    -- 6.3 Eliminar items de ventas del cliente
    DELETE FROM public.sale_items WHERE sale_id IN (
        SELECT id FROM public.sales WHERE store_id = target_user_id
    );
    
    -- 6.4 Eliminar ventas del cliente
    DELETE FROM public.sales WHERE store_id = target_user_id;
    
    -- 6.5 Eliminar clientes (customers) del negocio
    DELETE FROM public.customers WHERE store_id = target_user_id;
    
    -- 6.6 Eliminar productos del cliente
    DELETE FROM public.products WHERE store_id = target_user_id;
    
    -- 6.7 Eliminar personal del cliente
    DELETE FROM public.staff WHERE store_id = target_user_id;
    
    -- 6.8 Eliminar terminales del cliente
    DELETE FROM public.terminals WHERE store_id = target_user_id;
    
    -- 6.9 Eliminar cortes de caja del cliente
    DELETE FROM public.cash_cuts WHERE store_id = target_user_id;
    
    -- 6.10 Eliminar sesiones de caja del cliente
    DELETE FROM public.cash_sessions WHERE store_id = target_user_id;
    
    -- 6.11 Eliminar configuraciones del cliente
    DELETE FROM public.store_settings WHERE store_id = target_user_id;
    
    -- 6.12 Eliminar insumos del cliente (si existe la tabla)
    BEGIN
        DELETE FROM public.supplies WHERE store_id = target_user_id;
    EXCEPTION WHEN undefined_table THEN
        -- Tabla no existe, continuar
    END;
    
    -- 6.13 Finalmente, eliminar el perfil del cliente
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- 6.14 Eliminar usuario de autenticación (Para liberar el email)
    DELETE FROM auth.users WHERE id = target_user_id;

    -- 7. Retornar éxito con información
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

-- Otorgar permisos de ejecución solo a usuarios autenticados
GRANT EXECUTE ON FUNCTION delete_client_permanently(UUID, TEXT) TO authenticated;

-- Comentario descriptivo
COMMENT ON FUNCTION delete_client_permanently IS '⚠️ PELIGRO: Elimina permanentemente un cliente y TODOS sus datos. Requiere rol super_admin y PIN Maestro.';
