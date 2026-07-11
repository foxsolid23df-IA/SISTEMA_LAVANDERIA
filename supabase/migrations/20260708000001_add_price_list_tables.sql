-- ============================================================
-- Migración: Lista de precios por sucursal + Configuración de delivery
-- Fecha: 2026-07-08
-- ============================================================

-- 1. Tabla de categorías de servicios
CREATE TABLE IF NOT EXISTS public.service_categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stores can CRUD own service_categories"
  ON public.service_categories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_service_categories_user
  ON public.service_categories(user_id, sort_order);

-- 2. Tabla de prendas/servicios con precios
CREATE TABLE IF NOT EXISTS public.service_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  category_id bigint REFERENCES public.service_categories(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  unit text NOT NULL DEFAULT 'pieza' CHECK (unit IN ('pieza', 'kilo', 'docena', 'servicio')),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stores can CRUD own service_items"
  ON public.service_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_service_items_user_category
  ON public.service_items(user_id, category_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_service_items_user_active
  ON public.service_items(user_id, active);

-- 3. Tabla de configuración de delivery por sucursal
CREATE TABLE IF NOT EXISTS public.store_delivery_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users,
  min_free_delivery numeric(10,2) NOT NULL DEFAULT 250,
  small_order_fee numeric(10,2) NOT NULL DEFAULT 35,
  auto_reminder_enabled boolean NOT NULL DEFAULT true,
  reminder_minutes integer NOT NULL DEFAULT 30 CHECK (reminder_minutes > 0),
  currency text NOT NULL DEFAULT 'MXN',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_delivery_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stores can CRUD own delivery_settings"
  ON public.store_delivery_settings
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
