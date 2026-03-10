-- ==========================================
-- SCRIPT: CREACIÓN DE TABLA PARA HISTORIAL DE CORTES SEMANALES
-- ==========================================

-- 1. Tabla de Cortes Semanales (Reconciliations)
CREATE TABLE IF NOT EXISTS public.supply_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    supply_id UUID REFERENCES public.supplies(id) ON DELETE CASCADE,
    responsible TEXT NOT NULL,
    reconciliation_date DATE DEFAULT CURRENT_DATE,
    theoretical_stock DOUBLE PRECISION NOT NULL,
    physical_stock DOUBLE PRECISION NOT NULL,
    difference DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS
ALTER TABLE public.supply_reconciliations ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad (Aislamiento por Cliente)
DROP POLICY IF EXISTS "Users can CRUD own supply_reconciliations" ON public.supply_reconciliations;
CREATE POLICY "Users can CRUD own supply_reconciliations" ON public.supply_reconciliations
    FOR ALL USING (auth.uid() = user_id);

-- 4. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_supply_reconciliations_user_id ON public.supply_reconciliations(user_id);
CREATE INDEX IF NOT EXISTS idx_supply_reconciliations_supply_id ON public.supply_reconciliations(supply_id);
