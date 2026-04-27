-- ==========================================
-- MIGRACIÓN: Fix next_folio() - Prevenir regresión de folios
-- Fecha: 2026-04-27
-- ==========================================
-- Problema: La función next_folio() original usaba UPSERT simple que
-- podía inicializar el contador en 1 si el registro de folio_counters
-- se perdía. Además, el backfill mezclaba folio con id global (IDENTITY).
--
-- Solución: Función robusta con SELECT FOR UPDATE y fallback a MAX(folio)

-- 1. Reemplazar la función RPC con versión robusta
CREATE OR REPLACE FUNCTION public.next_folio()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_folio BIGINT;
    current_user_id UUID;
    max_existing_folio BIGINT;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user';
    END IF;
    
    -- Intentar obtener y lockear el contador existente
    SELECT last_folio INTO new_folio
    FROM public.folio_counters
    WHERE user_id = current_user_id
    FOR UPDATE;
    
    IF FOUND THEN
        -- Incrementar el existente
        new_folio := new_folio + 1;
        UPDATE public.folio_counters 
        SET last_folio = new_folio, updated_at = NOW()
        WHERE user_id = current_user_id;
    ELSE
        -- Primera vez o registro borrado: buscar el MAX(folio) real
        -- IMPORTANTE: Solo usar folio, NUNCA id (que es secuencia global)
        SELECT COALESCE(MAX(folio), 0) INTO max_existing_folio
        FROM public.orders
        WHERE user_id = current_user_id;
        
        new_folio := max_existing_folio + 1;
        
        INSERT INTO public.folio_counters (user_id, last_folio, updated_at)
        VALUES (current_user_id, new_folio, NOW())
        ON CONFLICT (user_id) DO UPDATE 
        SET last_folio = GREATEST(folio_counters.last_folio + 1, EXCLUDED.last_folio),
            updated_at = NOW()
        RETURNING last_folio INTO new_folio;
    END IF;
    
    RETURN new_folio;
END;
$$;

-- 2. Recalcular TODOS los contadores para corregir posibles inconsistencias
-- Solo actualiza si el MAX(folio) real es mayor que el contador actual
UPDATE public.folio_counters fc
SET last_folio = sub.max_folio,
    updated_at = NOW()
FROM (
    SELECT 
        user_id, 
        COALESCE(MAX(folio), 0) as max_folio
    FROM public.orders
    GROUP BY user_id
) sub
WHERE fc.user_id = sub.user_id
  AND fc.last_folio < sub.max_folio;
