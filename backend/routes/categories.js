// backend/routes/categories.js
// ─────────────────────────────────────────────────────────────
// Category Routes
// Mounted at: /api/categories
// ─────────────────────────────────────────────────────────────

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────
// Helper: enrich a list of products with thumbnail, minPrice,
// colorCount — mirrors the same logic in /api/products.
// ─────────────────────────────────────────────────────────────
async function enrichProducts(products) {
  return Promise.all(
    (products || []).map(async (product) => {
      const { data: variants } = await supabaseAdmin
        .from('product_variants')
        .select('price_cents, color_name, color_hex, size')
        .eq('product_id', product.id);

      const prices = (variants || []).map((v) => v.price_cents);
      const minPrice = prices.length ? Math.min(...prices) : null;
      const colorCount = new Set((variants || []).map((v) => v.color_name)).size;

      const colorMap = {};
      (variants || []).forEach((v) => { if (!colorMap[v.color_name]) colorMap[v.color_name] = v.color_hex || '#888888'; });
      const colors = Object.entries(colorMap).map(([name, hex]) => ({ name, hex }));
      const sizes = [...new Set((variants || []).map((v) => v.size))];

      const { data: images } = await supabaseAdmin
        .from('product_images')
        .select('url')
        .eq('product_id', product.id)
        .eq('angle', 'front')
        .order('sort_order', { ascending: true })
        .limit(1);

      const thumbnailUrl = images?.[0]?.url || null;

      return { ...product, thumbnailUrl, minPrice, colorCount, colors, sizes };
    })
  );
}

// ─────────────────────────────────────────────────────────────
// GET /api/categories
// Returns all categories sorted by sort_order.
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('id, slug, name, image_url, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[GET /api/categories]', error);
      return res.status(500).json({ error: 'Could not fetch categories' });
    }

    return res.json(data || []);
  } catch (err) {
    console.error('[GET /api/categories]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/categories/:slug/products
// Returns all products in the given category, enriched with
// thumbnailUrl, minPrice, and colorCount.
// ─────────────────────────────────────────────────────────────
router.get('/:slug/products', async (req, res) => {
  const { slug } = req.params;

  try {
    // 1. Find the category
    const { data: category, error: catErr } = await supabaseAdmin
      .from('categories')
      .select('id, slug, name, image_url')
      .eq('slug', slug)
      .maybeSingle();

    if (catErr || !category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // 2. Fetch products in this category
    const { data: products, error: pErr } = await supabaseAdmin
      .from('products')
      .select('id, slug, name, description, base_rating, rating_count, created_at')
      .eq('category_id', category.id)
      .order('created_at', { ascending: false });

    if (pErr) {
      console.error('[GET /api/categories/:slug/products]', pErr);
      return res.status(500).json({ error: 'Could not fetch products' });
    }

    // 3. Enrich with thumbnail + pricing
    const enriched = await enrichProducts(products);

    return res.json({ category, products: enriched });
  } catch (err) {
    console.error('[GET /api/categories/:slug/products]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
