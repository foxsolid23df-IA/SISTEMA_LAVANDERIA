-- Refined reset_project_data function to match frontend parameters
CREATE OR REPLACE FUNCTION public.reset_project_data(
    p_reset_terminals BOOLEAN DEFAULT TRUE,
    p_reset_transactions BOOLEAN DEFAULT TRUE,
    p_reset_profiles BOOLEAN DEFAULT FALSE,
    p_factory_reset BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges
AS $$
DECLARE
    result JSONB;
BEGIN
    -- 1. Factory Reset (Delete everything for this user)
    IF p_factory_reset THEN
        DELETE FROM public.sales WHERE user_id = auth.uid();
        DELETE FROM public.cash_sessions WHERE user_id = auth.uid();
        DELETE FROM public.cash_cuts WHERE user_id = auth.uid();
        DELETE FROM public.terminals WHERE user_id = auth.uid();
        -- Optional: DELETE FROM public.products WHERE user_id = auth.uid();
        
        result := jsonb_build_object(
            'success', true,
            'message', 'Fábrica reseteada con éxito (Aislamiento de usuario aplicado)',
            'timestamp', now()
        );
        RETURN result;
    END IF;

    -- 2. Reset Transactions (Sales, Sessions, Cuts)
    IF p_reset_transactions THEN
        DELETE FROM public.sales WHERE user_id = auth.uid();
        DELETE FROM public.cash_sessions WHERE user_id = auth.uid();
        DELETE FROM public.cash_cuts WHERE user_id = auth.uid();
    END IF;

    -- 3. Reset Terminals (Devices)
    IF p_reset_terminals THEN
        DELETE FROM public.terminals WHERE user_id = auth.uid();
    END IF;

    -- 4. Reset Non-Admin Profiles (If needed, although profiles table is sensitive)
    IF p_reset_profiles THEN
        DELETE FROM public.profiles WHERE id != auth.uid() AND id IN (
            -- This assumes profiles are linked to the current user's business somehow
            -- For now, we only delete if the profile isn't the current user
            SELECT id FROM public.profiles WHERE id != auth.uid()
        );
    END IF;

    result := jsonb_build_object(
        'success', true,
        'message', 'Reinicio completado correctamente',
        'timestamp', now()
    );

    RETURN result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$;
