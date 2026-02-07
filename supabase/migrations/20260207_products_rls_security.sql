-- =============================================================================
-- MIGRACIÓN: Habilitar RLS en tabla products para seguridad multi-tenant
-- EJECUTAR EN: Supabase SQL Editor (https://supabase.com/dashboard)
-- FECHA: 2026-02-07
-- =============================================================================

-- 1. Habilitar RLS en la tabla products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 2. Política: Los usuarios solo pueden VER sus propios productos
CREATE POLICY "Users can view own products" 
ON public.products 
FOR SELECT 
USING (auth.uid() = user_id);

-- 3. Política: Los usuarios solo pueden INSERTAR productos con su user_id
CREATE POLICY "Users can insert own products" 
ON public.products 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 4. Política: Los usuarios solo pueden ACTUALIZAR sus propios productos
CREATE POLICY "Users can update own products" 
ON public.products 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Política: Los usuarios solo pueden ELIMINAR sus propios productos
CREATE POLICY "Users can delete own products" 
ON public.products 
FOR DELETE 
USING (auth.uid() = user_id);

-- =============================================================================
-- NOTA: Esta migración asegura que incluso si hay un bug en el frontend,
-- la base de datos NUNCA retornará productos de otros usuarios.
-- =============================================================================
