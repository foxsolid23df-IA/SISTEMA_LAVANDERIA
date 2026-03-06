-- 1. Tabla para registrar administradores autorizados
CREATE TABLE IF NOT EXISTS public.super_admins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS en tablas críticas
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

-- 2. Función de Seguridad (is_super_admin)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE LOWER(email) = LOWER(auth.jwt()->>'email')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Políticas de Seguridad (RLS) para super_admins
DROP POLICY IF EXISTS "Super admins view all admins" ON public.super_admins;
CREATE POLICY "Super admins view all admins" ON public.super_admins
FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins insert admins" ON public.super_admins;
CREATE POLICY "Super admins insert admins" ON public.super_admins
FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());

-- 4. Políticas para invitation_codes (Licencias)
DROP POLICY IF EXISTS "Super admins manage everything" ON public.invitation_codes;
CREATE POLICY "Super admins manage everything" ON public.invitation_codes
FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Users view own license" ON public.invitation_codes;
CREATE POLICY "Users view own license" ON public.invitation_codes
FOR SELECT TO authenticated USING (auth.uid() = used_by);

-- 5. Actualizar trigger handle_new_user para saltar Super Admins
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Evitar crear perfil (tienda) si el correo pertenece a un super_admin ya registrado
    IF EXISTS (
        SELECT 1 FROM public.super_admins 
        WHERE LOWER(email) = LOWER(NEW.email)
    ) THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.profiles (
        id, 
        email,
        full_name, 
        store_name, 
        role,
        license_expires_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'store_name', ''),
        'admin',
        NOW() + INTERVAL '14 days'
    );
    
    RETURN NEW;
EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
WHEN OTHERS THEN
    RAISE WARNING 'Error creando perfil para usuario %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
