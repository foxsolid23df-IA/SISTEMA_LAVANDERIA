-- ============================================================
-- MIGRACIÓN: Módulo de Gastos (Expenses) - Mejoras y aseguramiento
-- Fecha: 2026-07-09
-- ============================================================
-- La tabla public.expenses ya existe en producción. Esta migración:
-- 1. Asegura columnas necesarias para el flujo de trabajo.
-- 2. Refuerza RLS (la política INSERT existente tenía qual NULL).
-- 3. Agrega índices de rendimiento.
-- 4. Hace user_id NOT NULL para garantizar aislamiento.

-- 1. Asegurar columnas necesarias
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- 2. Hacer user_id NOT NULL (crítico para aislamiento)
ALTER TABLE public.expenses
  ALTER COLUMN user_id SET NOT NULL;

-- 3. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(user_id, category);

-- 4. Habilitar RLS (en caso de que estuviera deshabilitada)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- 5. Reemplazar políticas inseguras por aislamiento total
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expenses;
  DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
  DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
  DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses;
  DROP POLICY IF EXISTS "Aislamiento Total SaaS" ON public.expenses;

  CREATE POLICY "Aislamiento Total SaaS" ON public.expenses
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
END $$;

-- 6. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_expenses_updated_at ON public.expenses;
CREATE TRIGGER trigger_update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_expenses_updated_at();

-- 7. Agregar tabla a realtime (opcional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public'
        AND c.relname = 'expenses'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
    END IF;
  END IF;
END $$;
