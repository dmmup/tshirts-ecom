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
    // Stock check: get the cart item's variant_id, then check stock
    const { data: cartItem } = await supabaseAdmin
      .from('cart_items')
      .select('variant_id')
      .eq('id', itemId)
      .single();

    if (cartItem) {
      const { data: variant } = await supabaseAdmin
        .from('product_variants')
        .select('stock')
        .eq('id', cartItem.variant_id)
        .single();

      if (variant && variant.stock !== null) {
        if (variant.stock === 0) {
          return res.status(409).json({ error: 'This item is out of stock' });
        }
        if (parseInt(quantity, 10) > variant.stock) {
          return res.status(409).json({ error: `Only ${variant.stock} available` });
        }
      }
    }

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

// ─────────────────────────────────────────────────────────────
// POST /api/cart/merge
// Body: { anonymousId, accessToken }
// Merges an anonymous cart into the authenticated user's cart.
// ─────────────────────────────────────────────────────────────
router.post('/merge', async (req, res) => {
  const { anonymousId, accessToken } = req.body;
  if (!anonymousId || !accessToken) {
    return res.status(400).json({ error: 'anonymousId and accessToken are required' });
  }

  try {
    // 1. Verify the access token and get the user
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (authErr || !user) {
      return res.status(401).json({ error: 'Invalid access token' });
    }
    const userId = user.id;

    // 2. Find the anonymous cart
    const { data: anonCart } = await supabaseAdmin
      .from('carts')
      .select('id')
      .eq('anonymous_id', anonymousId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!anonCart) {
      // No anonymous cart — find or create user cart and return its id
      const { data: existingUserCart } = await supabaseAdmin
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingUserCart) return res.json({ cartId: existingUserCart.id });

      const { data: newCart } = await supabaseAdmin
        .from('carts')
        .insert({ user_id: userId })
        .select('id')
        .single();
      return res.json({ cartId: newCart?.id ?? null });
    }

    // 3. Find or create a user cart
    let { data: userCart } = await supabaseAdmin
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!userCart) {
      const { data: created } = await supabaseAdmin
        .from('carts')
        .insert({ user_id: userId })
        .select('id')
        .single();
      userCart = created;
    }

    // 4. Fetch anon cart items
    const { data: anonItems } = await supabaseAdmin
      .from('cart_items')
      .select('*')
      .eq('cart_id', anonCart.id);

    if (anonItems && anonItems.length > 0) {
      // 5. Fetch existing user cart items (to merge quantities)
      const { data: userItems } = await supabaseAdmin
        .from('cart_items')
        .select('*')
        .eq('cart_id', userCart.id);

      const userItemMap = {};
      (userItems || []).forEach((item) => {
        userItemMap[item.variant_id] = item;
      });

      for (const anonItem of anonItems) {
        const existing = userItemMap[anonItem.variant_id];
        if (existing) {
          // Merge quantities
          await supabaseAdmin
            .from('cart_items')
            .update({ quantity: existing.quantity + anonItem.quantity })
            .eq('id', existing.id);
        } else {
          // Insert into user cart
          await supabaseAdmin
            .from('cart_items')
            .insert({
              cart_id: userCart.id,
              variant_id: anonItem.variant_id,
              quantity: anonItem.quantity,
              config: anonItem.config,
            });
        }
      }

      // 6. Remove anon cart items then anon cart
      await supabaseAdmin.from('cart_items').delete().eq('cart_id', anonCart.id);
      await supabaseAdmin.from('carts').delete().eq('id', anonCart.id);
    }

    // 7. Keep the original anonymous_id on the user cart so existing
    //    GET /api/cart?anonymousId= lookups continue to work.
    await supabaseAdmin
      .from('carts')
      .update({ anonymous_id: anonymousId })
      .eq('id', userCart.id);

    return res.json({ cartId: userCart.id });
  } catch (err) {
    console.error('[POST /api/cart/merge]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
