// backend/routes/products.js
// ─────────────────────────────────────────────────────────────
// Product Detail Page – Backend Routes
// Mounted at: /api/products
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ─────────────────────────────────────────────────────────────

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Admin client (service role) – NEVER expose to frontend
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────
// GET /api/products
// Returns all products with thumbnail, min price, color count
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { data: products, error: pErr } = await supabaseAdmin
      .from('products')
      .select('id, slug, name, description, base_rating, rating_count, created_at')
      .order('created_at', { ascending: false });

    if (pErr) {
      console.error('[GET /products]', pErr);
      return res.status(500).json({ error: 'Could not fetch products' });
    }

    const enriched = await Promise.all(
      (products || []).map(async (product) => {
        // Get min price + distinct color count from variants
        const { data: variants } = await supabaseAdmin
          .from('product_variants')
          .select('price_cents, color_name, color_hex, size')
          .eq('product_id', product.id);

        const prices = (variants || []).map((v) => v.price_cents);
        const minPrice = prices.length ? Math.min(...prices) : null;
        const colorCount = new Set((variants || []).map((v) => v.color_name)).size;

        // Unique colors and sizes for client-side filtering
        const colorMap = {};
        (variants || []).forEach((v) => { if (!colorMap[v.color_name]) colorMap[v.color_name] = v.color_hex || '#888888'; });
        const colors = Object.entries(colorMap).map(([name, hex]) => ({ name, hex }));
        const sizes = [...new Set((variants || []).map((v) => v.size))];

        // Get first front image as thumbnail
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

    return res.json(enriched);
  } catch (err) {
    console.error('[GET /products]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/products/:slug
// Returns product + all variants + all images
// ─────────────────────────────────────────────────────────────
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    const { data: product, error: pErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('slug', slug)
      .single();

    if (pErr || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const [{ data: variants }, { data: images }] = await Promise.all([
      supabaseAdmin
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id)
        .order('color_name')
        .order('size'),
      supabaseAdmin
        .from('product_images')
        .select('*')
        .eq('product_id', product.id)
        .order('sort_order'),
    ]);

    return res.json({ product, variants: variants || [], images: images || [] });
  } catch (err) {
    console.error('[GET /products/:slug]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/products/upload/sign
// Body: { filename, contentType, userId?, anonymousId? }
// Returns: { signedUrl, storagePath, token }
// Client uses signedUrl to PUT file directly to Supabase Storage
// ─────────────────────────────────────────────────────────────
router.post('/upload/sign', async (req, res) => {
  const { filename, contentType, userId, anonymousId } = req.body;

  if (!filename || !contentType) {
    return res.status(400).json({ error: 'filename and contentType are required' });
  }

  // Allowed MIME types
  const ALLOWED_TYPES = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
  if (!ALLOWED_TYPES.includes(contentType)) {
    return res.status(400).json({ error: 'File type not allowed. Use PNG, SVG, JPEG or WebP.' });
  }

  const ownerId = userId || anonymousId || 'anonymous';
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${ownerId}/${Date.now()}_${sanitizedFilename}`;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from('designs')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('[upload/sign] Supabase error:', error);
      return res.status(500).json({ error: 'Could not create signed URL' });
    }

    return res.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
    });
  } catch (err) {
    console.error('[upload/sign]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/products/upload/confirm
// Body: { storagePath, filename, fileSize, mimeType, userId?, anonymousId? }
// Verifies file exists in storage and creates audit record
// ─────────────────────────────────────────────────────────────
router.post('/upload/confirm', async (req, res) => {
  const { storagePath, filename, fileSize, mimeType, userId, anonymousId } = req.body;

  if (!storagePath || !filename) {
    return res.status(400).json({ error: 'storagePath and filename are required' });
  }

  try {
    // Verify file actually exists in storage
    const pathParts = storagePath.split('/');
    const folder = pathParts.slice(0, -1).join('/');
    const filename_only = pathParts[pathParts.length - 1];
    const { data: fileData, error: listErr } = await supabaseAdmin.storage
      .from('designs')
      .list(folder, {
        search: filename_only,
      });

    if (listErr || !fileData || fileData.length === 0) {
      return res.status(400).json({ error: 'File not found in storage' });
    }

    // Create audit record in design_uploads
    const { data: uploadRecord, error: dbErr } = await supabaseAdmin
      .from('design_uploads')
      .insert({
        user_id: userId || null,
        anonymous_id: anonymousId || null,
        storage_path: storagePath,
        filename,
        file_size: fileSize || null,
        mime_type: mimeType || null,
      })
      .select()
      .single();

    if (dbErr) {
      // Non-fatal – log but continue
      console.error('[upload/confirm] DB insert error:', dbErr);
    }

    // Build a short-lived signed read URL (1 hour) for immediate preview
    const { data: readUrl } = await supabaseAdmin.storage
      .from('designs')
      .createSignedUrl(storagePath, 3600);

    return res.json({
      success: true,
      storagePath,
      previewUrl: readUrl?.signedUrl || null,
      uploadId: uploadRecord?.id || null,
    });
  } catch (err) {
    console.error('[upload/confirm]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/products/cart/items
// Body: { variantId, quantity, config, userId?, anonymousId? }
// config shape: { backside, decoration, design_url, color, size }
// ─────────────────────────────────────────────────────────────
router.post('/cart/items', async (req, res) => {
  const { variantId, quantity = 1, config = {}, userId, anonymousId } = req.body;

  if (!variantId) {
    return res.status(400).json({ error: 'variantId is required' });
  }

  try {
    // Get or create cart
    let cartId;

    if (userId) {
      const { data: existing } = await supabaseAdmin
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        cartId = existing.id;
      } else {
        const { data: newCart } = await supabaseAdmin
          .from('carts')
          .insert({ user_id: userId })
          .select('id')
          .single();
        cartId = newCart.id;
      }
    } else if (anonymousId) {
      const { data: existing } = await supabaseAdmin
        .from('carts')
        .select('id')
        .eq('anonymous_id', anonymousId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        cartId = existing.id;
      } else {
        const { data: newCart } = await supabaseAdmin
          .from('carts')
          .insert({ anonymous_id: anonymousId })
          .select('id')
          .single();
        cartId = newCart.id;
      }
    } else {
      // Create ephemeral anonymous cart
      const { data: newCart } = await supabaseAdmin
        .from('carts')
        .insert({ anonymous_id: `anon_${Date.now()}` })
        .select('id, anonymous_id')
        .single();
      cartId = newCart.id;
      res.locals.newAnonymousId = newCart.anonymous_id;
    }

    // Stock check: fetch variant stock
    const { data: variant } = await supabaseAdmin
      .from('product_variants')
      .select('stock')
      .eq('id', variantId)
      .single();

    if (variant && variant.stock !== null) {
      // Check existing quantity in cart for this variant
      const { data: existingItems } = await supabaseAdmin
        .from('cart_items')
        .select('quantity')
        .eq('cart_id', cartId)
        .eq('variant_id', variantId);
      const existingQty = (existingItems || []).reduce((s, i) => s + i.quantity, 0);
      const requested = existingQty + parseInt(quantity, 10);
      if (variant.stock === 0) {
        return res.status(409).json({ error: 'This item is out of stock' });
      }
      if (requested > variant.stock) {
        return res.status(409).json({
          error: `Only ${variant.stock - existingQty} left in stock`,
        });
      }
    }

    // Insert cart item
    const { data: cartItem, error: ciErr } = await supabaseAdmin
      .from('cart_items')
      .insert({ cart_id: cartId, variant_id: variantId, quantity, config })
      .select()
      .single();

    if (ciErr) {
      console.error('[cart/items] DB error:', ciErr);
      return res.status(500).json({ error: 'Could not add item to cart' });
    }

    return res.status(201).json({
      cartItem,
      cartId,
      anonymousId: res.locals.newAnonymousId || anonymousId || null,
    });
  } catch (err) {
    console.error('[cart/items]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
