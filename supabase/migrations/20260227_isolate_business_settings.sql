-- ==========================================
-- SCRIPT: AISLAMIENTO MULTI-TENANT PARA CONFIGURACIÓN DE TICKETS
-- ==========================================
-- Descripción: Garantiza que la configuración de la tienda/tickets (business_settings)
-- esté estrictamente separada por cliente en Supabase para evitar mezclas.

DO $$
BEGIN
    -- 1. Intentar crear la tabla si por alguna razón no existe
    CREATE TABLE IF NOT EXISTS public.business_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        name TEXT,
        address TEXT,
        phone TEXT,
        logo_url TEXT,
        ticket_message TEXT,
        printer_width INTEGER DEFAULT 80,
        printer_font_size INTEGER DEFAULT 12,
        printer_font_family TEXT DEFAULT 'Courier New',
        printer_is_bold BOOLEAN DEFAULT false,
        printer_margin INTEGER DEFAULT 0,
        ticket_double_print BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- 2. Asegurarse que la columna user_id existe en caso de que la tabla ya estuviera allí antigua
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'business_settings' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.business_settings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Habilitar Seguridad a Nivel de Filas (RLS)
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- 4. Limpiar políticas antiguas (Evitar conflictos)
DROP POLICY IF EXISTS "Users can view own business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Users can insert own business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Users can update own business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Users can delete own business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Users can CRUD own business settings" ON public.business_settings;

-- 5. Crear la política MÁESTRA de seguridad: 
-- SOLO el usuario autenticado puede Ver, Insertar, Actualizar o Borrar SUS propias configuraciones.
CREATE POLICY "Users can CRUD own business settings" ON public.business_settings
    FOR ALL USING (auth.uid() = user_id);
