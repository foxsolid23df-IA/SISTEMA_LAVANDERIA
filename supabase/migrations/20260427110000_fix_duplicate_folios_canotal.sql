-- ==========================================
-- MIGRACIÓN: Corregir folios duplicados de Cañotal
-- Fecha: 2026-04-27
-- ==========================================
-- Problema: La regresión del contador causó que se re-emitieran
-- 23 folios que ya existían (rango 11672-11694), creando duplicados.
--
-- Estrategia:
--   - La orden MÁS ANTIGUA de cada par conserva su folio original
--   - La orden MÁS NUEVA recibe un folio nuevo secuencial
--   - Se actualiza el contador al nuevo MAX(folio)
--
-- IMPORTANTE: Ejecutar en una sola transacción (Supabase SQL Editor lo hace por defecto)

-- 1. Reasignar folios únicos a las órdenes duplicadas (las más nuevas)
WITH current_max AS (
    SELECT COALESCE(MAX(folio), 0) AS max_f
    FROM public.orders
    WHERE user_id = '80cb0874-5973-4cbe-b9b9-3a3cb4586fc1'
),
duplicates_ranked AS (
    SELECT 
        o.id,
        o.folio,
        o.created_at,
        ROW_NUMBER() OVER (PARTITION BY o.folio ORDER BY o.created_at ASC) AS rn
    FROM public.orders o
    WHERE o.user_id = '80cb0874-5973-4cbe-b9b9-3a3cb4586fc1'
      AND o.folio IN (
        SELECT folio 
        FROM public.orders 
        WHERE user_id = '80cb0874-5973-4cbe-b9b9-3a3cb4586fc1'
        GROUP BY folio 
        HAVING COUNT(*) > 1
      )
),
to_fix AS (
    SELECT 
        dr.id,
        dr.folio AS old_folio,
        (SELECT max_f FROM current_max) + ROW_NUMBER() OVER (ORDER BY dr.created_at ASC) AS new_folio
    FROM duplicates_ranked dr
    WHERE dr.rn > 1  -- Solo las duplicadas (no las originales)
)
UPDATE public.orders o
SET folio = tf.new_folio
FROM to_fix tf
WHERE o.id = tf.id;

-- 2. Actualizar el contador de folio_counters al nuevo MAX
UPDATE public.folio_counters
SET last_folio = (
    SELECT COALESCE(MAX(folio), 0) 
    FROM public.orders 
    WHERE user_id = '80cb0874-5973-4cbe-b9b9-3a3cb4586fc1'
),
updated_at = NOW()
WHERE user_id = '80cb0874-5973-4cbe-b9b9-3a3cb4586fc1';

-- 3. Verificación: confirmar que ya no hay duplicados
SELECT user_id, folio, COUNT(*) AS repeticiones
FROM public.orders
WHERE user_id = '80cb0874-5973-4cbe-b9b9-3a3cb4586fc1'
  AND deleted_at IS NULL
GROUP BY user_id, folio
HAVING COUNT(*) > 1;
-- ✅ Esperado: 0 filas (sin duplicados)
