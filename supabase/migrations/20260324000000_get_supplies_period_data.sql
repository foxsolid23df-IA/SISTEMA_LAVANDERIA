-- ==========================================
-- SCRIPT: FUNCION PARA CALCULAR CORTE DE INSUMOS
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_supplies_period_data(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    supply_id UUID,
    name TEXT,
    unit_measure TEXT,
    current_system_stock DOUBLE PRECISION,
    initial_stock DOUBLE PRECISION,
    period_entries DOUBLE PRECISION,
    period_usage DOUBLE PRECISION,
    theoretical_stock DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
            ) as net_change_since_start
        FROM supply_movements sm
        WHERE sm.user_id = p_user_id
          AND sm.usage_date >= p_start_date
        GROUP BY sm.supply_id
    ),
    movements_in_period AS (
        -- Movimientos estrictamente en el periodo [p_start_date, p_end_date]
        SELECT 
            sm.supply_id,
            SUM(CASE WHEN sm.type = 'ENTRY_WEEKLY' THEN sm.quantity ELSE 0 END) as period_entries,
            SUM(CASE WHEN sm.type IN ('USAGE_MORNING', 'USAGE_AFTERNOON') THEN sm.quantity ELSE 0 END) as period_usage
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
        s.current_stock as current_system_stock,
        COALESCE(s.current_stock - COALESCE(mas.net_change_since_start, 0), s.current_stock) as initial_stock,
        COALESCE(mip.period_entries, 0) as period_entries,
        COALESCE(mip.period_usage, 0) as period_usage,
        COALESCE(s.current_stock - COALESCE(mas.net_change_since_start, 0), s.current_stock) + COALESCE(mip.period_entries, 0) - COALESCE(mip.period_usage, 0) as theoretical_stock
    FROM public.supplies s
    LEFT JOIN movements_after_start mas ON mas.supply_id = s.id
    LEFT JOIN movements_in_period mip ON mip.supply_id = s.id
    WHERE s.user_id = p_user_id
    ORDER BY s.name ASC;
END;
$$;
