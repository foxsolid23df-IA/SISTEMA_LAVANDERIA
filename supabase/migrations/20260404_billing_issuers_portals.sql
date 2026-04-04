-- ==========================================
-- MIGRACIÓN: Módulo de Emisores Fiscales + Portales de Branding
-- Replica exacta desde POS → SISTEMA_LAVANDERIA
-- ==========================================

-- 1. TABLA billing_issuers (Emisores Fiscales / CSD)
CREATE TABLE IF NOT EXISTS public.billing_issuers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  rfc text NOT NULL,
  razon_social text NOT NULL,
  regimen_fiscal text NOT NULL,
  codigo_postal text NOT NULL,
  branch_name text DEFAULT 'Matriz principal',
  is_csd_loaded boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para billing_issuers
ALTER TABLE public.billing_issuers ENABLE ROW LEVEL SECURITY;

-- Solo el dueño puede ver sus emisores
CREATE POLICY "Users can SELECT own billing_issuers"
  ON public.billing_issuers FOR SELECT
  USING (auth.uid() = user_id);

-- Solo el dueño puede insertar
CREATE POLICY "Users can INSERT own billing_issuers"
  ON public.billing_issuers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Solo el dueño puede actualizar
CREATE POLICY "Users can UPDATE own billing_issuers"
  ON public.billing_issuers FOR UPDATE
  USING (auth.uid() = user_id);

-- Solo el dueño puede eliminar
CREATE POLICY "Users can DELETE own billing_issuers"
  ON public.billing_issuers FOR DELETE
  USING (auth.uid() = user_id);


-- 2. TABLA billing_portals (Branding / Logo del Portal de Facturación)
CREATE TABLE IF NOT EXISTS public.billing_portals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  billing_issuer_id uuid REFERENCES public.billing_issuers(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  nombre_marca text,
  logo_url text,
  brand_color text DEFAULT '#003f87',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para billing_portals
ALTER TABLE public.billing_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can SELECT own billing_portals"
  ON public.billing_portals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can INSERT own billing_portals"
  ON public.billing_portals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can UPDATE own billing_portals"
  ON public.billing_portals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can DELETE own billing_portals"
  ON public.billing_portals FOR DELETE
  USING (auth.uid() = user_id);


-- 3. STORAGE BUCKET para logos de branding
INSERT INTO storage.buckets (id, name, public)
  VALUES ('branding', 'branding', true)
  ON CONFLICT DO NOTHING;

-- Política de lectura pública para logos
CREATE POLICY "Public read branding logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'branding');

-- Solo usuarios autenticados pueden subir logos
CREATE POLICY "Authenticated users can upload to branding"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'branding' AND auth.role() = 'authenticated');
