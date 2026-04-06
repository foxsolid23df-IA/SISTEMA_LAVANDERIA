-- FIX: Precision drift in supply stocks
-- This migration ensures that all calculated stock metrics in the RPC are rounded to 4 decimal places.
-- It also performs a one-time cleanup of existing data.

-- 1. Create or replace the RPC with rounding logic
CREATE OR REPLACE FUNCTION public.get_supplies_period_data(p_user_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(supply_id uuid, name text, unit_measure text, current_system_stock numeric, initial_stock numeric, period_entries numeric, period_usage numeric, theoretical_stock numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    WITH movements_after_start AS (
        -- Movimientos desde p_start_date hasta hoy (para revertir y hallar stock inicial)
        SELECT 
            sm.supply_id,
            SUM(
                CASE 
                    WHEN sm.type = 'ENTRY_WEEKLY' THEN sm.quantity
                    WHEN sm.type IN ('USAGE_MORNING', 'USAGE_AFTERNOON') THEN -sm.quantity
                    WHEN sm.type = 'ADJUSTMENT' THEN sm.quantity
                    ELSE 0
                END
            )::NUMERIC as net_change_since_start
        FROM supply_movements sm
        WHERE sm.user_id = p_user_id
          AND sm.usage_date >= p_start_date
        GROUP BY sm.supply_id
    ),
    movements_in_period AS (
        -- Movimientos estrictamente en el periodo [p_start_date, p_end_date]
        SELECT 
            sm.supply_id,
            SUM(CASE WHEN sm.type = 'ENTRY_WEEKLY' THEN sm.quantity ELSE 0 END)::NUMERIC as period_entries,
            SUM(CASE WHEN sm.type IN ('USAGE_MORNING', 'USAGE_AFTERNOON') THEN sm.quantity ELSE 0 END)::NUMERIC as period_usage
        FROM supply_movements sm
        WHERE sm.user_id = p_user_id
          AND sm.usage_date >= p_start_date
          AND sm.usage_date <= p_end_date
        GROUP BY sm.supply_id
    )
    SELECT 
        s.id as supply_id,
        s.name,
        s.unit_measure,
        ROUND(s.current_stock::NUMERIC, 4) as current_system_stock,
        ROUND(COALESCE(s.current_stock - COALESCE(mas.net_change_since_start, 0), s.current_stock)::NUMERIC, 4) as initial_stock,
        ROUND(COALESCE(mip.period_entries, 0)::NUMERIC, 4) as period_entries,
        ROUND(COALESCE(mip.period_usage, 0)::NUMERIC, 4) as period_usage,
        ROUND((COALESCE(s.current_stock - COALESCE(mas.net_change_since_start, 0), s.current_stock) + COALESCE(mip.period_entries, 0) - COALESCE(mip.period_usage, 0))::NUMERIC, 4) as theoretical_stock
    FROM public.supplies s
    LEFT JOIN movements_after_start mas ON mas.supply_id = s.id
    LEFT JOIN movements_in_period mip ON mip.supply_id = s.id
    WHERE s.user_id = p_user_id
      AND (s.is_active = true OR s.is_active IS NULL)
    ORDER BY s.name ASC;
END;
$function$;

-- 2. Data cleanup: Round existing float residues
UPDATE public.supplies SET current_stock = ROUND(current_stock::NUMERIC, 4);
