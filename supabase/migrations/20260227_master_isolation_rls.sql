-- =========================================================================
-- 🛡️ SCRIPT MAESTRO DE SEGURIDAD Y AISLAMIENTO MULTI-TENANT (SaaS) 🛡️
-- =========================================================================
-- Descripción: Este script revisa cada una de las tablas transaccionales del sistema, 
-- confirma que exista la columna 'user_id' para atar los datos al cliente correcto, 
-- fuerza la Seguridad a Nivel de Fila (RLS) y aplica la política estricta de 
-- "Cada usuario solo ve y modifica sus propios datos".
-- 
-- Ejecuta este código completo en Supabase SQL Editor.

DO $$
DECLARE
    t_name TEXT;
    table_list TEXT[] := ARRAY[
        'products',
        'sales',
        'sale_items',
        'staff',
        'cash_cuts',
        'customers',
        'orders',
        'order_items',
        'active_carts',
        'active_cart_items',
        'cash_sessions',
        'cash_withdrawals',
        'exchange_rates',
        'supplies',
        'terminals',
        'business_settings'
    ];
BEGIN
    -- 1. Iterar sobre la lista maestra de tablas operativas
    FOREACH t_name IN ARRAY table_list
    LOOP
        -- A. Verificar si la tabla existe en la base de datos
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t_name) THEN
            
            -- B. Asegurar que existe la columna user_id en la tabla
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = t_name AND column_name = 'user_id' AND table_schema = 'public'
            ) THEN
                -- Agregar columna si faltaba
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid()', t_name);
            END IF;

            -- C. Habilitar explícitamente la Seguridad a Nivel de Filas (RLS)
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);

            -- D. Borrar políticas previas "basura" o mal configuradas sobre pertenencia
            -- (Para limpieza general atrapamos errores en caso de que la política no exista)
            BEGIN EXECUTE format('DROP POLICY IF EXISTS "Users can CRUD own rows" ON public.%I', t_name); EXCEPTION WHEN OTHERS THEN END;
            BEGIN EXECUTE format('DROP POLICY IF EXISTS "Users can CRUD own %s" ON public.%I', t_name, t_name); EXCEPTION WHEN OTHERS THEN END;
            BEGIN EXECUTE format('DROP POLICY IF EXISTS "Users can view own data" ON public.%I', t_name); EXCEPTION WHEN OTHERS THEN END;
            BEGIN EXECUTE format('DROP POLICY IF EXISTS "Users can insert own data" ON public.%I', t_name); EXCEPTION WHEN OTHERS THEN END;
            BEGIN EXECUTE format('DROP POLICY IF EXISTS "Users can update own data" ON public.%I', t_name); EXCEPTION WHEN OTHERS THEN END;
            BEGIN EXECUTE format('DROP POLICY IF EXISTS "Users can delete own data" ON public.%I', t_name); EXCEPTION WHEN OTHERS THEN END;
            
            -- Políticas genéricas creadas previamente en el ecosistema (coincidencias comunes)
            BEGIN EXECUTE format('DROP POLICY IF EXISTS "Aislamiento Total SaaS" ON public.%I', t_name); EXCEPTION WHEN OTHERS THEN END;

            -- E. Crear la única política monolítica segura y auditada:
            -- Solo el dueño de la sesión actual puede Leer/Insertar/Actualizar/Borrar en la tabla
            EXECUTE format(
                'CREATE POLICY "Aislamiento Total SaaS" ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', 
                t_name
            );

        END IF;
    END LOOP;
END $$;
