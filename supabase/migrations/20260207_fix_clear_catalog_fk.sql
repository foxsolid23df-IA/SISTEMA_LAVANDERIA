-- ==========================================
-- FIX: Error al Limpiar Catálogo (Foreign Key Constraint)
-- ==========================================
-- Descripción: Permite limpiar el catálogo de un cliente desvinculando product_id 
-- de las órdenes y ventas previas antes de eliminar los productos.
-- Esto mantiene el historial de ventas (nombres y precios) pero permite borrar los productos.

CREATE OR REPLACE FUNCTION public.clear_client_catalog(
    target_user_id UUID,
    master_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    -- 1. Validar PIN Maestro
    IF master_pin IS NULL OR master_pin <> '2026SOP' THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    END IF;

    -- 2. Validar rol de Super Admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
    END IF;

    -- 3. Desvincular productos de órdenes y ventas (FK Fix)
    -- Pone en NULL el product_id pero mantiene product_name, price, etc. en el item
    UPDATE public.order_items 
    SET product_id = NULL 
    WHERE product_id IN (SELECT id FROM public.products WHERE user_id = target_user_id);

    UPDATE public.sale_items 
    SET product_id = NULL 
    WHERE product_id IN (SELECT id FROM public.products WHERE user_id = target_user_id);

    -- 4. Eliminar productos del usuario
    DELETE FROM public.products
    WHERE user_id = target_user_id;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- 5. Retornar éxito
    RETURN jsonb_build_object(
        'success', true, 
        'deleted_count', v_deleted_count,
        'message', 'Catálogo limpiado correctamente'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION clear_client_catalog(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION clear_client_catalog IS 'Elimina todos los productos y servicios de un cliente, desvinculándolos de órdenes previas para evitar errores de FK.';
