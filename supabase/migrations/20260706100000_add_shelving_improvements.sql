-- Migración: Mejoras al sistema de estanterías
-- Tabla de historial de movimientos + campo auto_assign

-- 1. Tabla de historial de movimientos
CREATE TABLE IF NOT EXISTS public.shelf_movement_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
  shelf_id UUID REFERENCES public.shelves(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('assigned', 'removed', 'reassigned')),
  performed_by TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_shelf_movement_user_id ON public.shelf_movement_log(user_id);
CREATE INDEX IF NOT EXISTS idx_shelf_movement_order_id ON public.shelf_movement_log(order_id);
CREATE INDEX IF NOT EXISTS idx_shelf_movement_created_at ON public.shelf_movement_log(created_at);

-- 3. RLS
ALTER TABLE public.shelf_movement_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'movement_log_isolation' AND tablename = 'shelf_movement_log') THEN
    CREATE POLICY "movement_log_isolation" ON public.shelf_movement_log
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Campo auto-asignación en business_settings
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS shelving_auto_assign BOOLEAN DEFAULT false;

-- 5. Comentarios
COMMENT ON TABLE public.shelf_movement_log IS 'Historial de movimientos de estanterías (asignaciones, retiros, reasignaciones)';
COMMENT ON COLUMN public.shelf_movement_log.action IS 'Tipo de acción: assigned, removed, reassigned';
COMMENT ON COLUMN public.shelf_movement_log.performed_by IS 'Nombre del empleado que realizó la acción';
COMMENT ON COLUMN public.shelf_movement_log.metadata IS 'Datos adicionales (ej: estantería anterior en reasignación)';
COMMENT ON COLUMN public.business_settings.shelving_auto_assign IS 'Auto-asignar estantería disponible al recibir una orden';
