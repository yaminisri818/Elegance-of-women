/*
# Update storage bucket file size limit to 5MB

Updates all 4 storage buckets (product-images, category-images, brand-assets, banners)
to enforce a 5MB maximum file size (down from 10MB).
*/

UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id IN ('product-images', 'category-images', 'brand-assets', 'banners');
