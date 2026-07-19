/*
# Create banners and brand_settings tables

1. New Tables
   - `banners`
     - id (uuid, primary key)
     - title (text) — banner headline
     - subtitle (text, nullable) — banner subheadline
     - button_text (text, nullable) — CTA button label
     - button_link (text, nullable) — CTA button URL/hash path
     - image_url (text) — public URL from banners bucket
     - bucket_path (text, nullable) — storage path for deletion
     - banner_type (text) — 'hero' | 'promotional' | 'offer'
     - is_active (boolean, default true)
     - sort_order (integer, default 0)
     - created_at (timestamptz)

   - `brand_settings`
     - id (uuid, primary key)
     - key (text, unique) — setting key e.g. 'logo', 'favicon', 'footer_logo'
     - value (text) — public URL or string value
     - bucket_path (text, nullable) — storage path for deletion
     - created_at (timestamptz)
     - updated_at (timestamptz)

2. Security
   - RLS enabled on both tables
   - Public SELECT on both (site needs to read logo/banners without auth)
   - Authenticated-only INSERT/UPDATE/DELETE (admin uploads)
*/

CREATE TABLE IF NOT EXISTS banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  button_text text,
  button_link text,
  image_url text NOT NULL,
  bucket_path text,
  banner_type text NOT NULL DEFAULT 'hero',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view banners table" ON banners;
CREATE POLICY "Public can view banners table"
ON banners FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert banners" ON banners;
CREATE POLICY "Authenticated users can insert banners"
ON banners FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update banners" ON banners;
CREATE POLICY "Authenticated users can update banners"
ON banners FOR UPDATE
TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete banners" ON banners;
CREATE POLICY "Authenticated users can delete banners"
ON banners FOR DELETE
TO authenticated
USING (true);

-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS brand_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  bucket_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE brand_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view brand settings" ON brand_settings;
CREATE POLICY "Public can view brand settings"
ON brand_settings FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert brand settings" ON brand_settings;
CREATE POLICY "Authenticated users can insert brand settings"
ON brand_settings FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update brand settings" ON brand_settings;
CREATE POLICY "Authenticated users can update brand settings"
ON brand_settings FOR UPDATE
TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete brand settings" ON brand_settings;
CREATE POLICY "Authenticated users can delete brand settings"
ON brand_settings FOR DELETE
TO authenticated
USING (true);

-- Seed default brand settings keys so UPDATE works (INSERT if not exists)
INSERT INTO brand_settings (key, value) VALUES
  ('logo', ''),
  ('footer_logo', ''),
  ('favicon', ''),
  ('loading_logo', '')
ON CONFLICT (key) DO NOTHING;
