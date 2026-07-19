/*
# Create Storage Buckets for Elegance of Women

1. Storage Buckets Created
   - `product-images` — for individual product photos and galleries
   - `category-images` — for category banner/hero images
   - `brand-assets` — for logos, brand imagery, watermarks
   - `banners` — for homepage banners, promotional slides

2. Access Policy
   - All buckets are PUBLIC (anyone can read/view images)
   - Only authenticated users can upload/update/delete images (admin protection)
   - Max file size: 10MB
   - Allowed MIME types: image/jpeg, image/png, image/svg+xml, image/webp

3. Security
   - Public SELECT allows the website to show images without authentication
   - Authenticated-only INSERT/UPDATE/DELETE protects uploads from anonymous abuse
*/

-- Create product-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/svg+xml','image/webp']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/svg+xml','image/webp'];

-- Create category-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'category-images',
  'category-images',
  true,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/svg+xml','image/webp']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/svg+xml','image/webp'];

-- Create brand-assets bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/svg+xml','image/webp']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/svg+xml','image/webp'];

-- Create banners bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/svg+xml','image/webp']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/svg+xml','image/webp'];

-- =============================================
-- STORAGE RLS POLICIES: product-images
-- =============================================
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- =============================================
-- STORAGE RLS POLICIES: category-images
-- =============================================
DROP POLICY IF EXISTS "Public can view category images" ON storage.objects;
CREATE POLICY "Public can view category images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'category-images');

DROP POLICY IF EXISTS "Authenticated users can upload category images" ON storage.objects;
CREATE POLICY "Authenticated users can upload category images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'category-images');

DROP POLICY IF EXISTS "Authenticated users can update category images" ON storage.objects;
CREATE POLICY "Authenticated users can update category images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'category-images');

DROP POLICY IF EXISTS "Authenticated users can delete category images" ON storage.objects;
CREATE POLICY "Authenticated users can delete category images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'category-images');

-- =============================================
-- STORAGE RLS POLICIES: brand-assets
-- =============================================
DROP POLICY IF EXISTS "Public can view brand assets" ON storage.objects;
CREATE POLICY "Public can view brand assets"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'brand-assets');

DROP POLICY IF EXISTS "Authenticated users can upload brand assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload brand assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'brand-assets');

DROP POLICY IF EXISTS "Authenticated users can update brand assets" ON storage.objects;
CREATE POLICY "Authenticated users can update brand assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'brand-assets');

DROP POLICY IF EXISTS "Authenticated users can delete brand assets" ON storage.objects;
CREATE POLICY "Authenticated users can delete brand assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'brand-assets');

-- =============================================
-- STORAGE RLS POLICIES: banners
-- =============================================
DROP POLICY IF EXISTS "Public can view banners" ON storage.objects;
CREATE POLICY "Public can view banners"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "Authenticated users can upload banners" ON storage.objects;
CREATE POLICY "Authenticated users can upload banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banners');

DROP POLICY IF EXISTS "Authenticated users can update banners" ON storage.objects;
CREATE POLICY "Authenticated users can update banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "Authenticated users can delete banners" ON storage.objects;
CREATE POLICY "Authenticated users can delete banners"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'banners');
