-- ============================================================
-- Migración: Bucket de imágenes de lista de precios + columna URL
-- Fecha: 2026-07-08
-- ============================================================

-- 1. Bucket público para imágenes de lista de precios
INSERT INTO storage.buckets (id, name, public)
VALUES ('price-list-images', 'price-list-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. RLS: authenticated users can upload to own folder
DROP POLICY IF EXISTS "Stores can upload price list images" ON storage.objects;
CREATE POLICY "Stores can upload price list images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'price-list-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. RLS: public read for all
DROP POLICY IF EXISTS "Public can read price list images" ON storage.objects;
CREATE POLICY "Public can read price list images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'price-list-images');

-- 4. RLS: authenticated users can update own images
DROP POLICY IF EXISTS "Stores can update price list images" ON storage.objects;
CREATE POLICY "Stores can update price list images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'price-list-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'price-list-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. RLS: authenticated users can delete own images
DROP POLICY IF EXISTS "Stores can delete price list images" ON storage.objects;
CREATE POLICY "Stores can delete price list images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'price-list-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Agregar columna price_list_image_url a store_delivery_settings
ALTER TABLE public.store_delivery_settings
ADD COLUMN IF NOT EXISTS price_list_image_url text;
