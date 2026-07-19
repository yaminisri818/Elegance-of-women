-- Insert the logos storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

-- Public read policy for logos bucket
DROP POLICY IF EXISTS "public_read_logos" ON storage.objects;
CREATE POLICY "public_read_logos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'logos');

-- Authenticated upload policy for logos bucket
DROP POLICY IF EXISTS "auth_upload_logos" ON storage.objects;
CREATE POLICY "auth_upload_logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

-- Authenticated update policy for logos bucket
DROP POLICY IF EXISTS "auth_update_logos" ON storage.objects;
CREATE POLICY "auth_update_logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos');

-- Authenticated delete policy for logos bucket
DROP POLICY IF EXISTS "auth_delete_logos" ON storage.objects;
CREATE POLICY "auth_delete_logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos');
