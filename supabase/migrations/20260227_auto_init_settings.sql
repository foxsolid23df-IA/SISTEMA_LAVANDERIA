-- ==========================================
-- SCRIPT: AUTO-INICIALIZACIÓN DE CONFIGURACIÓN
-- ==========================================
-- Descripción: Asegura que cada usuario (dueño de tienda) tenga 
-- un registro de business_settings por defecto. Esto garantiza 
-- que el ticket se cargue correctamente para todos los usuarios.

-- 1. Función para crear configuración por defecto
CREATE OR REPLACE FUNCTION public.initialize_business_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.business_settings (
        user_id, 
        name, 
        ticket_message, 
        printer_width, 
        printer_font_size, 
        printer_margin, 
        printer_font_family,
        printer_is_bold,
        ticket_double_print
    )
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'store_name', 'Mi Lavandería'), 
        '¡Gracias por su compra, vuelva pronto!', 
        80, 
        12, 
        0, 
        'Courier New',
        false,
        false
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger para nuevos registros (auth.users)
DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.initialize_business_settings();

-- 3. Inicializar para usuarios existentes que no la tengan
INSERT INTO public.business_settings (
    user_id, 
    name, 
    ticket_message
)
SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'store_name', 'Mi Lavandería'),
    '¡Gracias por su compra, vuelva pronto!'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.business_settings WHERE user_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- 4. Asegurar que RLS permite a los empleados leer la configuración del dueño
-- En este sistema, los empleados comparten la sesión del dueño, 
-- pero si en el futuro tienen cuentas separadas, necesitamos esto:
DROP POLICY IF EXISTS "Aislamiento Total SaaS" ON public.business_settings;
CREATE POLICY "Aislamiento Total SaaS" ON public.business_settings
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Habilitar Realtime para la tabla de settings
-- Esto es crucial para que el cambio en un equipo se vea en todos inmediatamente
ALTER TABLE public.business_settings REPLICA IDENTITY FULL;
-- (Asegúrate de habilitar la tabla en el dashboard de Supabase > Realtime)
