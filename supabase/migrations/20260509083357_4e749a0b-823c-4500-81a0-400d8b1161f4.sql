
-- Add new columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sku text;

CREATE INDEX IF NOT EXISTS idx_products_business ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);

-- Create product-images storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path layout is {business_id}/{filename}
-- Public read
DROP POLICY IF EXISTS "product-images public read" ON storage.objects;
CREATE POLICY "product-images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Insert: business managers/owners only
DROP POLICY IF EXISTS "product-images manager insert" ON storage.objects;
CREATE POLICY "product-images manager insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_business_manager(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "product-images manager update" ON storage.objects;
CREATE POLICY "product-images manager update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND public.is_business_manager(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "product-images manager delete" ON storage.objects;
CREATE POLICY "product-images manager delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND public.is_business_manager(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
