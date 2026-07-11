-- ==========================================
-- MIGRACIÓN: Asegurar columnas nullable en orders
-- Fecha: 2026-07-01
-- ==========================================
-- Problema: El Edge Function delivery-actions (create_express_pickup)
-- no incluye cash_session_id ni created_by_staff_id al crear órdenes POS.
-- Si estas columnas tienen constraint NOT NULL, el INSERT falla silenciosamente
-- y la orden nunca aparece en el POS.
--
-- Solución: Asegurar que ambas columnas sean nullable con DEFAULT NULL

-- 1. cash_session_id: nullable con DEFAULT NULL
DO $$
BEGIN
    -- Solo modificar si la columna existe y tiene NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'cash_session_id'
        AND table_schema = 'public' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.orders ALTER COLUMN cash_session_id DROP NOT NULL;
        RAISE NOTICE 'cash_session_id: NOT NULL removido';
    ELSE
        RAISE NOTICE 'cash_session_id: ya es nullable o no existe';
    END IF;
END $$;

-- 2. created_by_staff_id: nullable con DEFAULT NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'created_by_staff_id'
        AND table_schema = 'public' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.orders ALTER COLUMN created_by_staff_id DROP NOT NULL;
        RAISE NOTICE 'created_by_staff_id: NOT NULL removido';
    ELSE
        RAISE NOTICE 'created_by_staff_id: ya es nullable o no existe';
    END IF;
END $$;

-- 3. Verificar que customer_id también sea nullable (el Edge Function siempre envía null)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'customer_id'
        AND table_schema = 'public' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;
        RAISE NOTICE 'customer_id: NOT NULL removido';
    END IF;
END $$;

-- ==========================================
-- VERIFICACIÓN
-- ==========================================
-- Ejecutar para confirmar que las columnas son nullable:
-- SELECT column_name, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'orders' AND table_schema = 'public'
-- AND column_name IN ('cash_session_id', 'created_by_staff_id', 'customer_id')
-- ORDER BY column_name;
