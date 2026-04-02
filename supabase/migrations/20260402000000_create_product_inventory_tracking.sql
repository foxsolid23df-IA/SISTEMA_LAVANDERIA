-- 1. Tabla de Movimientos de Productos (Entradas/Ajustes)
CREATE TABLE IF NOT EXISTS public.product_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'ENTRY', 'SALE', 'ADJUSTMENT'
    quantity DOUBLE PRECISION NOT NULL,
    notes TEXT,
    staff_name TEXT,
    usage_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Cortes Semanales (Reconciliations)
CREATE TABLE IF NOT EXISTS public.product_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    responsible TEXT NOT NULL,
    reconciliation_date DATE DEFAULT CURRENT_DATE,
    theoretical_stock DOUBLE PRECISION NOT NULL,
    physical_stock DOUBLE PRECISION NOT NULL,
    difference DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar RLS
ALTER TABLE public.product_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reconciliations ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (Aislamiento por Cliente)
DROP POLICY IF EXISTS "Users can CRUD own product_movements" ON public.product_movements;
CREATE POLICY "Users can CRUD own product_movements" ON public.product_movements
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own product_reconciliations" ON public.product_reconciliations;
CREATE POLICY "Users can CRUD own product_reconciliations" ON public.product_reconciliations
    FOR ALL USING (auth.uid() = user_id);

-- 5. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_product_movements_user_id ON public.product_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_product_movements_product_id ON public.product_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reconciliations_user_id ON public.product_reconciliations(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reconciliations_product_id ON public.product_reconciliations(product_id);

-- 6. RPC Function para obtener datos del periodo para el Nuevo Corte de Productos
CREATE OR REPLACE FUNCTION public.get_products_period_data(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE (
    supply_id UUID,
    name TEXT,
    initial_stock DOUBLE PRECISION,
    total_entries DOUBLE PRECISION,
    total_consumption DOUBLE PRECISION,   -- Puede incluir 'SALE' o 'USAGE'
    expected_stock DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    WITH DateBounds AS (
        SELECT 
            p_start_date AS s_date,
            p_end_date AS e_date
    ),
    InitialStock AS (
        SELECT 
            pr.product_id AS supply_id,
            pr.physical_stock AS initial_stock
        FROM public.product_reconciliations pr
        WHERE pr.user_id = p_user_id
          AND pr.reconciliation_date = p_start_date
    ),
    FallbackInitialStock AS (
        SELECT 
            p.id AS supply_id,
            COALESCE(i.initial_stock, p.stock) AS initial_stock
        FROM public.products p
        LEFT JOIN InitialStock i ON i.supply_id = p.id
        WHERE p.user_id = p_user_id
    ),
    PeriodMovements AS (
        SELECT 
            pm.product_id AS supply_id,
            SUM(CASE WHEN pm.type = 'ENTRY' THEN pm.quantity ELSE 0 END) AS period_entries,
            SUM(CASE WHEN pm.type IN ('SALE', 'USAGE') THEN pm.quantity ELSE 0 END) AS period_consumption
        FROM public.product_movements pm, DateBounds db
        WHERE pm.user_id = p_user_id
          AND pm.usage_date > db.s_date
          AND pm.usage_date <= db.e_date
        GROUP BY pm.product_id
    )
    SELECT 
        p.id AS supply_id,
        p.name,
        COALESCE(fis.initial_stock, 0) AS initial_stock,
        COALESCE(pm.period_entries, 0) AS total_entries,
        COALESCE(pm.period_consumption, 0) AS total_consumption,
        (COALESCE(fis.initial_stock, 0) + COALESCE(pm.period_entries, 0) - COALESCE(pm.period_consumption, 0)) AS expected_stock
    FROM public.products p
    LEFT JOIN FallbackInitialStock fis ON p.id = fis.supply_id
    LEFT JOIN PeriodMovements pm ON p.id = pm.supply_id
    WHERE p.user_id = p_user_id
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
