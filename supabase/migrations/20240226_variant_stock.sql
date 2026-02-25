-- Migration: 20240226_variant_stock.sql
-- Adds stock tracking to product_variants.
-- NULL = unlimited stock (default for all existing/new variants)
-- 0    = out of stock
-- > 0  = tracked quantity available

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT NULL;
