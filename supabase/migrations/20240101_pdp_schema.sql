-- ============================================================
-- Product Detail Page Schema Migration
-- ============================================================

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_rating NUMERIC(3,2) DEFAULT 0,
  rating_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Variants (one row per color × size combination)
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  size TEXT NOT NULL,
  price_cents INT NOT NULL,
  sku TEXT UNIQUE,
  stock INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Images (by color + angle)
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_name TEXT,          -- NULL means applies to all colors
  angle TEXT NOT NULL DEFAULT 'front',  -- front | back | side | detail
  url TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

-- Carts
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cart Items
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity INT NOT NULL DEFAULT 1,
  config JSONB DEFAULT '{}'::jsonb,
  -- config shape: { backside: 'blank'|'color', decoration: 'dtg'|'embroidery'|'screen',
  --                 design_url: string, design_preview_url: string, color: string, size: string }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Design Uploads (audit trail for user-uploaded files)
CREATE TABLE IF NOT EXISTS design_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  cart_item_id UUID REFERENCES cart_items(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row-Level Security (RLS)
-- ============================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_uploads ENABLE ROW LEVEL SECURITY;

-- Public read on catalog tables
CREATE POLICY "Public read products"  ON products        FOR SELECT USING (true);
CREATE POLICY "Public read variants"  ON product_variants FOR SELECT USING (true);
CREATE POLICY "Public read images"    ON product_images   FOR SELECT USING (true);

-- Carts: authenticated users own their row; anonymous rows are open (no session token)
-- NOTE: The backend uses the service-role key, so it bypasses RLS entirely.
--       These policies protect direct Supabase client access.
CREATE POLICY "Cart owner access" ON carts FOR ALL USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (auth.uid() IS NULL AND anonymous_id IS NOT NULL)
);

CREATE POLICY "Cart items owner access" ON cart_items FOR ALL USING (
  cart_id IN (
    SELECT id FROM carts
    WHERE user_id = auth.uid()
       OR anonymous_id IS NOT NULL
  )
);

-- Design uploads: owners can read their own; anyone may insert (backend validates)
CREATE POLICY "Design upload owner read" ON design_uploads FOR SELECT USING (
  user_id = auth.uid()
  OR (auth.uid() IS NULL AND anonymous_id IS NOT NULL)
);

CREATE POLICY "Design upload insert" ON design_uploads FOR INSERT WITH CHECK (
  user_id = auth.uid() OR auth.uid() IS NULL
);

-- ============================================================
-- Storage Bucket + Policies
-- Run in Supabase Dashboard SQL Editor (needs owner privileges)
-- ============================================================

-- Create private "designs" bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('designs', 'designs', false)
ON CONFLICT (id) DO NOTHING;

-- Allow uploads to user's own folder (auth users) or anon_ folders
CREATE POLICY "Users upload own designs" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'designs'
  AND (
    auth.uid()::text = (storage.foldername(name))[2]
    OR (storage.foldername(name))[2] LIKE 'anon_%'
  )
);

-- Allow reads from user's own folder or anon_ folders
CREATE POLICY "Users read own designs" ON storage.objects FOR SELECT
USING (
  bucket_id = 'designs'
  AND (
    auth.uid()::text = (storage.foldername(name))[2]
    OR (storage.foldername(name))[2] LIKE 'anon_%'
  )
);

-- ============================================================
-- Seed Data: Gildan Budget Unisex T-shirt
-- ============================================================

INSERT INTO products (id, slug, name, description, base_rating, rating_count)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'gildan-budget-unisex-tshirt',
  'Gildan Budget Unisex T-shirt',
  'Classic unisex fit, perfect for custom printing. 100% pre-shrunk cotton. Available in a wide range of colors and sizes.',
  4.6,
  247
) ON CONFLICT (slug) DO NOTHING;

-- Variants: White ($12.99)
INSERT INTO product_variants (product_id, color_name, color_hex, size, price_cents, sku, stock)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'White', '#FFFFFF', s.size, 1299, 'GBT-WHT-' || s.size, 100
FROM (VALUES ('S'), ('M'), ('L'), ('XL'), ('2XL'), ('3XL')) AS s(size)
ON CONFLICT (sku) DO NOTHING;

-- Variants: Black ($12.99)
INSERT INTO product_variants (product_id, color_name, color_hex, size, price_cents, sku, stock)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Black', '#1A1A1A', s.size, 1299, 'GBT-BLK-' || s.size, 85
FROM (VALUES ('S'), ('M'), ('L'), ('XL'), ('2XL'), ('3XL')) AS s(size)
ON CONFLICT (sku) DO NOTHING;

-- Variants: Navy ($13.99)
INSERT INTO product_variants (product_id, color_name, color_hex, size, price_cents, sku, stock)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Navy', '#1B2A4A', s.size, 1399, 'GBT-NVY-' || s.size, 70
FROM (VALUES ('S'), ('M'), ('L'), ('XL'), ('2XL'), ('3XL')) AS s(size)
ON CONFLICT (sku) DO NOTHING;

-- Variants: Red ($12.99 for S–XL, $14.99 for 2XL–3XL)
INSERT INTO product_variants (product_id, color_name, color_hex, size, price_cents, sku, stock)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Red', '#C0392B', 'S',   1299, 'GBT-RED-S',   60),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Red', '#C0392B', 'M',   1299, 'GBT-RED-M',   60),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Red', '#C0392B', 'L',   1299, 'GBT-RED-L',   60),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Red', '#C0392B', 'XL',  1299, 'GBT-RED-XL',  60),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Red', '#C0392B', '2XL', 1499, 'GBT-RED-2XL', 30),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Red', '#C0392B', '3XL', 1499, 'GBT-RED-3XL', 20)
ON CONFLICT (sku) DO NOTHING;

-- Product Images (placeholder URLs – swap for real CDN links in production)
INSERT INTO product_images (product_id, color_name, angle, url, sort_order)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'White', 'front',  'https://placehold.co/600x700/FFFFFF/333333?text=White+Front',  1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'White', 'back',   'https://placehold.co/600x700/FFFFFF/333333?text=White+Back',   2),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Black', 'front',  'https://placehold.co/600x700/1A1A1A/EEEEEE?text=Black+Front',  1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Black', 'back',   'https://placehold.co/600x700/1A1A1A/EEEEEE?text=Black+Back',   2),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Navy',  'front',  'https://placehold.co/600x700/1B2A4A/EEEEEE?text=Navy+Front',   1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Navy',  'back',   'https://placehold.co/600x700/1B2A4A/EEEEEE?text=Navy+Back',    2),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Red',   'front',  'https://placehold.co/600x700/C0392B/EEEEEE?text=Red+Front',    1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Red',   'back',   'https://placehold.co/600x700/C0392B/EEEEEE?text=Red+Back',     2)
ON CONFLICT DO NOTHING;
