-- ─────────────────────────────────────────────────────────────
-- Migration: 20240224_categories.sql
-- Adds categories table and links products to categories.
-- ─────────────────────────────────────────────────────────────

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        UNIQUE NOT NULL,
  name       TEXT        NOT NULL,
  image_url  TEXT,                          -- replace with Supabase Storage public URL
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add category_id FK to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS products_category_id_idx ON products(category_id);

-- 3. Seed the 12 standard categories
--    image_url is NULL initially; update via:
--      UPDATE categories SET image_url = '<your-storage-url>' WHERE slug = '<slug>';
INSERT INTO categories (slug, name, sort_order) VALUES
  ('t-shirts',     'T-Shirts',     1),
  ('sweatshirts',  'Sweatshirts',  2),
  ('hats',         'Hats',         3),
  ('polos',        'Polos',        4),
  ('long-sleeves', 'Long Sleeves', 5),
  ('performance',  'Performance',  6),
  ('women',        'Women',        7),
  ('jackets',      'Jackets',      8),
  ('jerseys',      'Jerseys',      9),
  ('tank-tops',    'Tank Tops',    10),
  ('youth',        'Youth',        11),
  ('tote-bags',    'Tote Bags',    12)
ON CONFLICT (slug) DO NOTHING;
