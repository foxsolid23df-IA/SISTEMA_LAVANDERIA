-- Migración: Sistema de estanterías para localización de ropa por QR
-- Permite asignar órdenes a ubicaciones físicas (fila + columna) y generar códigos QR

-- 1. Tabla de estanterías (catálogo por lavandería)
CREATE TABLE IF NOT EXISTS public.shelves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  row_label TEXT NOT NULL,
  column_number INTEGER NOT NULL,
  label TEXT NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, row_label, column_number)
);

-- 2. Tabla de asignaciones de órdenes a estanterías
CREATE TABLE IF NOT EXISTS public.order_shelf_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  shelf_id UUID REFERENCES public.shelves(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  removed_at TIMESTAMPTZ,
  notes TEXT
);

-- 3. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_shelves_user_id ON public.shelves(user_id);
CREATE INDEX IF NOT EXISTS idx_shelves_status ON public.shelves(status);
CREATE INDEX IF NOT EXISTS idx_shelf_assignments_order_id ON public.order_shelf_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_shelf_assignments_shelf_id ON public.order_shelf_assignments(shelf_id);
CREATE INDEX IF NOT EXISTS idx_shelf_assignments_user_id ON public.order_shelf_assignments(user_id);

-- 4. RLS policies (aislamiento por usuario, patrón existente)
ALTER TABLE public.shelves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_shelf_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'shelves_isolation' AND tablename = 'shelves') THEN
    CREATE POLICY "shelves_isolation" ON public.shelves
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'shelf_assignments_isolation' AND tablename = 'order_shelf_assignments') THEN
    CREATE POLICY "shelf_assignments_isolation" ON public.order_shelf_assignments
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Campos de configuración en business_settings
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS shelving_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS shelving_rows INTEGER DEFAULT 5;

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS shelving_columns INTEGER DEFAULT 10;

-- 6. Comentarios
COMMENT ON TABLE public.shelves IS 'Catálogo de estanterías/ubicaciones físicas por lavandería';
COMMENT ON COLUMN public.shelves.row_label IS 'Etiqueta de la fila (A, B, C...)';
COMMENT ON COLUMN public.shelves.column_number IS 'Número de columna (1, 2, 3...)';
COMMENT ON COLUMN public.shelves.label IS 'Código combinado de la estantería (ej: A3)';
COMMENT ON COLUMN public.shelves.status IS 'Estado: available, occupied, maintenance';

COMMENT ON TABLE public.order_shelf_assignments IS 'Asignaciones de órdenes de lavandería a estanterías';
COMMENT ON COLUMN public.order_shelf_assignments.assigned_by IS 'Nombre del empleado que realizó la asignación';
COMMENT ON COLUMN public.order_shelf_assignments.removed_at IS 'Fecha cuando se retiró la ropa de la estantería';

COMMENT ON COLUMN public.business_settings.shelving_enabled IS 'Habilita el módulo de estanterías para esta lavandería';
COMMENT ON COLUMN public.business_settings.shelving_rows IS 'Número de filas de estanterías (default 5 = A-E)';
COMMENT ON COLUMN public.business_settings.shelving_columns IS 'Número de columnas de estanterías (default 10)';
