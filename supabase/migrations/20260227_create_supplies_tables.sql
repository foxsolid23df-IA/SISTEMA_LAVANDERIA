-- ==========================================
-- SCRIPT: CREACIÓN DE TABLAS DE INSUMOS (CLOUD)
-- ==========================================
-- Descripción: Crea las tablas para el control de insumos internos
-- que anteriormente solo vivían en la base de datos local SQLite.

-- 1. Tabla de Insumos (Catálogo)
CREATE TABLE IF NOT EXISTS public.supplies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit_measure TEXT DEFAULT 'GALON',
    current_stock DOUBLE PRECISION DEFAULT 0,
    min_stock DOUBLE PRECISION DEFAULT 0,
    image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Movimientos de Insumos (Entradas/Consumos)
CREATE TABLE IF NOT EXISTS public.supply_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    supply_id UUID REFERENCES public.supplies(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'ENTRY_WEEKLY', 'USAGE_MORNING', 'USAGE_AFTERNOON', 'ADJUSTMENT'
    quantity DOUBLE PRECISION NOT NULL,
    notes TEXT,
    staff_name TEXT,
    usage_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar RLS
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_movements ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (Aislamiento por Cliente)
DROP POLICY IF EXISTS "Users can CRUD own supplies" ON public.supplies;
CREATE POLICY "Users can CRUD own supplies" ON public.supplies
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own supply_movements" ON public.supply_movements;
CREATE POLICY "Users can CRUD own supply_movements" ON public.supply_movements
    FOR ALL USING (auth.uid() = user_id);

-- 5. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_supplies_user_id ON public.supplies(user_id);
CREATE INDEX IF NOT EXISTS idx_supply_movements_user_id ON public.supply_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_supply_movements_supply_id ON public.supply_movements(supply_id);
