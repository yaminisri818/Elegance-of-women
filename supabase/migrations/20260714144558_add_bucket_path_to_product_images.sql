/*
# Add bucket_path to product_images

Adds a nullable `bucket_path` column to `product_images` so the admin can
delete storage files when removing product images.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_images' AND column_name = 'bucket_path' AND table_schema = 'public'
  ) THEN
    ALTER TABLE product_images ADD COLUMN bucket_path text;
  END IF;
END $$;
