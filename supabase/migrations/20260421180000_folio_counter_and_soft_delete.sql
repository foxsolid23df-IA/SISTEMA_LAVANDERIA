-- ==========================================
-- MIGRACIÓN: Sistema de Folios Lógicos + Soft Delete
-- Fecha: 2026-04-21
-- ==========================================
-- Problema: Los folios (números de orden) presentan saltos porque
-- dependen del ID autoincremental de PostgreSQL (IDENTITY), que nunca
-- retrocede ante transacciones fallidas, y porque las eliminaciones
-- son permanentes (hard delete).
--
-- Solución 1: Contador de folios independiente por negocio
-- Solución 2: Soft delete (eliminación lógica) en órdenes

-- ==========================================
-- PARTE 1: FOLIO COUNTER POR NEGOCIO
-- ==========================================

-- 1A. Asegurar que la columna folio exista en orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'folio' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN folio BIGINT;
    END IF;
END $$;

-- 1B. Crear tabla de contadores de folio por negocio
CREATE TABLE IF NOT EXISTS public.folio_counters (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    last_folio BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.folio_counters ENABLE ROW LEVEL SECURITY;

-- Política de aislamiento
DO $$ 
BEGIN
    BEGIN
        DROP POLICY IF EXISTS "Aislamiento Total SaaS" ON public.folio_counters;
    EXCEPTION WHEN OTHERS THEN
    END;
    
    CREATE POLICY "Aislamiento Total SaaS" ON public.folio_counters
        FOR ALL USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
END $$;

-- 1C. Función RPC atómica para obtener el siguiente folio
-- Usa SECURITY DEFINER para que pueda operar sin restricciones de RLS
CREATE OR REPLACE FUNCTION public.next_folio()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_folio BIGINT;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user';
    END IF;
    
    -- Upsert atómico: inserta con folio=1 o incrementa el existente
    INSERT INTO public.folio_counters (user_id, last_folio, updated_at)
    VALUES (current_user_id, 1, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET 
        last_folio = folio_counters.last_folio + 1,
        updated_at = NOW()
    RETURNING last_folio INTO new_folio;
    
    RETURN new_folio;
END;
$$;

-- 1D. Inicializar contadores para negocios existentes
-- El folio la primera orden nueva será MAX(folio o id) + 1
-- Esto garantiza continuidad con la numeración que el cliente ya conoce
INSERT INTO public.folio_counters (user_id, last_folio, updated_at)
SELECT 
    user_id, 
    COALESCE(MAX(COALESCE(folio, id)), 0),
    NOW()
FROM public.orders
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE 
SET last_folio = EXCLUDED.last_folio
WHERE folio_counters.last_folio < EXCLUDED.last_folio;

-- 1E. Backfill: Asignar folios a órdenes existentes que no tengan uno
-- Se asigna el valor del ID actual para mantener compatibilidad
UPDATE public.orders SET folio = id WHERE folio IS NULL;

-- 1F. Crear índice para búsquedas rápidas por folio
CREATE INDEX IF NOT EXISTS idx_orders_folio ON public.orders (folio);

-- ==========================================
-- PARTE 2: SOFT DELETE
-- ==========================================

-- 2A. Agregar columnas de soft delete a orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'deleted_at' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'deleted_by_staff_id' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN deleted_by_staff_id BIGINT DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'deletion_reason' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN deletion_reason TEXT DEFAULT NULL;
    END IF;
END $$;

-- 2B. Índice parcial para consultas rápidas excluyendo eliminados
CREATE INDEX IF NOT EXISTS idx_orders_not_deleted 
ON public.orders (created_at DESC) 
WHERE deleted_at IS NULL;

-- ==========================================
-- VERIFICACIÓN
-- ==========================================
-- Puedes validar con:
-- SELECT * FROM public.folio_counters;
-- SELECT id, folio, deleted_at FROM public.orders ORDER BY id DESC LIMIT 20;
