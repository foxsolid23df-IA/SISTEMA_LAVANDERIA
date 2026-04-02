-- ==============================================================
-- KARDEX DE INVENTARIO (ENTRADAS / SALIDAS / VENTAS)
-- ==============================================================

-- 1. Eliminar versiones erróneas si existen
DROP TABLE IF EXISTS public.product_movements CASCADE;
DROP TABLE IF EXISTS public.product_reconciliations CASCADE;

-- 2. Tabla de Movimientos de Productos (KARDEX)
CREATE TABLE public.product_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES public.products(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'IN' (Entrada), 'OUT' (Salida/Merma), 'SALE' (Venta aut.)
    quantity INTEGER NOT NULL,
    previous_stock INTEGER,
    new_stock INTEGER,
    unit_cost NUMERIC,
    unit_price NUMERIC,
    notes TEXT,
    staff_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.product_movements ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Users can CRUD own product_movements" ON public.product_movements;
CREATE POLICY "Users can CRUD own product_movements" ON public.product_movements
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_product_movements_user_id ON public.product_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_product_movements_product_id ON public.product_movements(product_id);

-- 3. Función RPC para registrar movimientos transaccionalmente
CREATE OR REPLACE FUNCTION public.register_inventory_movement(
    p_product_id BIGINT,
    p_type TEXT,
    p_quantity INTEGER,
    p_unit_cost NUMERIC,
    p_unit_price NUMERIC,
    p_notes TEXT,
    p_staff_name TEXT
) RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_old_stock INTEGER;
    v_new_stock INTEGER;
    v_result JSON;
BEGIN
    -- Determinar el usuario logueado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    -- Obtener el stock actual del producto (con bloqueo para concurrencia evitar race conditions)
    SELECT stock INTO v_old_stock 
    FROM public.products 
    WHERE id = p_product_id AND user_id = v_user_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado o sin permisos';
    END IF;

    -- Calcular nuevo stock
    IF p_type = 'IN' THEN
        v_new_stock := v_old_stock + p_quantity;
    ELSIF p_type = 'OUT' THEN
        v_new_stock := v_old_stock - p_quantity;
    ELSIF p_type = 'SALE' THEN
        v_new_stock := v_old_stock - p_quantity;
    ELSE
        RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_type;
    END IF;

    -- Actualizar el inventario base
    -- Nota: Al ingresar, también podríamos actualizar el precio/costo general si hubiese columnas, 
    -- pero por ahora las mantenemos históricas en el movimiento.
    UPDATE public.products 
    SET stock = v_new_stock
    WHERE id = p_product_id AND user_id = v_user_id;

    -- Registrar el movimiento
    INSERT INTO public.product_movements (
        user_id,
        product_id,
        type,
        quantity,
        previous_stock,
        new_stock,
        unit_cost,
        unit_price,
        notes,
        staff_name
    ) VALUES (
        v_user_id,
        p_product_id,
        p_type,
        p_quantity,
        v_old_stock,
        v_new_stock,
        p_unit_cost,
        p_unit_price,
        p_notes,
        p_staff_name
    );

    v_result := json_build_object(
        'success', true,
        'product_id', p_product_id,
        'old_stock', v_old_stock,
        'new_stock', v_new_stock
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
