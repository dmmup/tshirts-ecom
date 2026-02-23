// backend/routes/cart.js
// ─────────────────────────────────────────────────────────────
// Cart Routes
// Mounted at: /api/cart
// ─────────────────────────────────────────────────────────────

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────
// GET /api/cart?anonymousId=xxx
// Returns cart with enriched items (variant + product + thumbnail)
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { anonymousId } = req.query;

  if (!anonymousId) {
    return res.json({ cartId: null, items: [] });
  }

  try {
    // 1. Find cart by anonymousId
    const { data: cart, error: cartErr } = await supabaseAdmin
      .from('carts')
      .select('id')
      .eq('anonymous_id', anonymousId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cartErr || !cart) {
      return res.json({ cartId: null, items: [] });
    }

    // 2. Fetch cart items
    const { data: cartItems, error: itemsErr } = await supabaseAdmin
      .from('cart_items')
      .select('*')
      .eq('cart_id', cart.id)
      .order('created_at', { ascending: true });

    if (itemsErr || !cartItems || cartItems.length === 0) {
      return res.json({ cartId: cart.id, items: [] });
    }

    // 3. Enrich each item with variant + product + thumbnail
    const enriched = await Promise.all(
      cartItems.map(async (item) => {
        // Fetch variant
        const { data: variant } = await supabaseAdmin
          .from('product_variants')
          .select('id, product_id, color_name, color_hex, size, price_cents, sku')
          .eq('id', item.variant_id)
          .single();

        if (!variant) {
          return { ...item, variant: null, product: null, thumbnailUrl: null };
        }

        // Fetch product
        const { data: product } = await supabaseAdmin
          .from('products')
          .select('id, name, slug')
          .eq('id', variant.product_id)
          .single();

        // Fetch thumbnail: front image matching the item's color
        const colorName = item.config?.color || variant.color_name;
        const { data: images } = await supabaseAdmin
          .from('product_images')
          .select('url')
          .eq('product_id', variant.product_id)
          .eq('angle', 'front')
          .eq('color_name', colorName)
          .limit(1);

        // Fall back to any front image if color-specific one not found
        let thumbnailUrl = images?.[0]?.url || null;
        if (!thumbnailUrl) {
          const { data: fallbackImages } = await supabaseAdmin
            .from('product_images')
            .select('url')
            .eq('product_id', variant.product_id)
            .eq('angle', 'front')
            .limit(1);
          thumbnailUrl = fallbackImages?.[0]?.url || null;
        }

        return {
          id: item.id,
          quantity: item.quantity,
          config: item.config || {},
          variant,
          product: product || null,
          thumbnailUrl,
        };
      })
    );

    return res.json({ cartId: cart.id, items: enriched });
  } catch (err) {
    console.error('[GET /api/cart]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/cart/items/:itemId
// Body: { quantity }
// ─────────────────────────────────────────────────────────────
router.patch('/items/:itemId', async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'quantity must be ≥ 1' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('cart_items')
      .update({ quantity })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('[PATCH /api/cart/items]', error);
      return res.status(500).json({ error: 'Could not update item' });
    }

    return res.json({ success: true, item: data });
  } catch (err) {
    console.error('[PATCH /api/cart/items]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/cart/items/:itemId
// ─────────────────────────────────────────────────────────────
router.delete('/items/:itemId', async (req, res) => {
  const { itemId } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('[DELETE /api/cart/items]', error);
      return res.status(500).json({ error: 'Could not remove item' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/cart/items]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
