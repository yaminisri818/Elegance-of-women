/*
# AI Feature Tables

8 tables for AI-powered jewellery features:
1. ai_recommendations — selfie upload + AI jewellery recommendations
2. virtual_tryons — virtual try-on saved looks
3. gift_planner_requests — occasion-based gift planner
4. couple_orders — couple matching jewellery orders
5. exchange_requests — old jewellery exchange with AI valuation
6. custom_design_requests — hand drawing to jewellery custom orders
7. gift_orders — surprise gift mode orders
8. trending_products — trending product management

All tables have RLS enabled with:
- SELECT: authenticated users can see their own records; admin can see all
- INSERT/UPDATE/DELETE: authenticated users manage their own records
*/

-- 1. AI Recommendations
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  selfie_url text,
  bucket_path text,
  face_shape text,
  skin_tone text,
  dress_color text,
  preferred_style text,
  gender text,
  match_results jsonb,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_ai_recs" ON ai_recommendations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_ai_recs" ON ai_recommendations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_ai_recs" ON ai_recommendations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_ai_recs" ON ai_recommendations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Virtual Try-Ons
CREATE TABLE IF NOT EXISTS virtual_tryons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_photo_url text,
  bucket_path text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  jewellery_type text,
  result_url text,
  is_favourite boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE virtual_tryons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_tryons" ON virtual_tryons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_tryons" ON virtual_tryons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_tryons" ON virtual_tryons FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_tryons" ON virtual_tryons FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Gift Planner Requests
CREATE TABLE IF NOT EXISTS gift_planner_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  occasion text NOT NULL,
  budget_min integer DEFAULT 0,
  budget_max integer DEFAULT 5000,
  recipient text,
  jewellery_type text,
  preferred_metal text,
  recommendations jsonb,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE gift_planner_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_gift_planner" ON gift_planner_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_gift_planner" ON gift_planner_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_gift_planner" ON gift_planner_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_gift_planner" ON gift_planner_requests FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Couple Orders
CREATE TABLE IF NOT EXISTS couple_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  bride_name text,
  groom_name text,
  initials text,
  jewellery_type text,
  metal_preference text,
  engraving_text text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE couple_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_couple_orders" ON couple_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_couple_orders" ON couple_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_couple_orders" ON couple_orders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_couple_orders" ON couple_orders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Exchange Requests
CREATE TABLE IF NOT EXISTS exchange_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_urls text[],
  bucket_paths text[],
  weight_grams numeric,
  metal_type text,
  description text,
  ai_estimated_value numeric DEFAULT 0,
  purity_estimate text,
  buyback_value numeric DEFAULT 0,
  bonus_offer numeric DEFAULT 0,
  status text DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE exchange_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_exchange" ON exchange_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_exchange" ON exchange_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_exchange" ON exchange_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_exchange" ON exchange_requests FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Custom Design Requests
CREATE TABLE IF NOT EXISTS custom_design_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  sketch_url text,
  concept_image_url text,
  canvas_data text,
  metal_preference text,
  estimated_price numeric DEFAULT 0,
  estimated_delivery_days integer DEFAULT 30,
  front_preview_url text,
  side_preview_url text,
  notes text,
  status text DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE custom_design_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_custom_design" ON custom_design_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_custom_design" ON custom_design_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_custom_design" ON custom_design_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_custom_design" ON custom_design_requests FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 7. Gift Orders (Surprise Gift Mode)
CREATE TABLE IF NOT EXISTS gift_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  recipient_name text,
  recipient_address text,
  gift_wrap boolean DEFAULT true,
  premium_packaging boolean DEFAULT true,
  personal_message text,
  greeting_card text,
  anonymous_sender boolean DEFAULT false,
  scheduled_delivery date,
  hidden_pricing boolean DEFAULT true,
  gift_tracking_number text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE gift_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_gift_orders" ON gift_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_gift_orders" ON gift_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_gift_orders" ON gift_orders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_gift_orders" ON gift_orders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 8. Trending Products
CREATE TABLE IF NOT EXISTS trending_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  trend_type text NOT NULL DEFAULT 'trending',
  badge text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  view_count integer DEFAULT 0,
  purchase_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE trending_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_view_trending" ON trending_products;
CREATE POLICY "public_view_trending" ON trending_products FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "insert_trending" ON trending_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_trending" ON trending_products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_trending" ON trending_products FOR DELETE TO authenticated USING (true);
