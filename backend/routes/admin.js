// backend/routes/admin.js
// ─────────────────────────────────────────────────────────────
// Admin Routes
// Mounted at: /api/admin
// Protected by ADMIN_SECRET env var (Authorization: Bearer <secret>)
// ─────────────────────────────────────────────────────────────

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Auth middleware ───────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/verify
// Body: { secret }
// ─────────────────────────────────────────────────────────────
router.post('/verify', (req, res) => {
  const { secret } = req.body;
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }
  return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/dashboard
// Returns stats, 30-day daily revenue, top products, recent orders.
// ─────────────────────────────────────────────────────────────
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const PAID_STATUSES = ['paid', 'fulfilled', 'shipped'];

    // Start of current calendar month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 30-day window for chart
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [
      { data: paidOrders },
      { count: totalOrders },
      { count: pendingCount },
      { count: totalProducts },
      { data: recentOrders },
    ] = await Promise.all([
      // All paid/fulfilled/shipped orders — used for revenue stats + chart
      supabaseAdmin
        .from('orders')
        .select('id, created_at, subtotal_cents')
        .in('status', PAID_STATUSES),
      // Total orders (all statuses)
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }),
      // Pending orders
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      // Total products
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
      // Last 6 orders for recent-orders panel
      supabaseAdmin
        .from('orders')
        .select('id, created_at, status, subtotal_cents, shipping_name, shipping_email')
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    // ── Revenue stats ──────────────────────────────────────────
    const totalRevenue = (paidOrders || []).reduce((s, o) => s + (o.subtotal_cents || 0), 0);
    const monthRevenue = (paidOrders || [])
      .filter((o) => o.created_at >= startOfMonth)
      .reduce((s, o) => s + (o.subtotal_cents || 0), 0);

    // ── Build 30-day daily revenue array ──────────────────────
    const dailyMap = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const order of (paidOrders || [])) {
      const key = order.created_at.slice(0, 10);
      if (dailyMap[key] !== undefined) dailyMap[key] += order.subtotal_cents || 0;
    }
    const dailyRevenue = Object.entries(dailyMap).map(([date, revenue_cents]) => ({
      date,
      revenue_cents,
    }));

    // ── Top products (from all paid orders) ───────────────────
    const paidOrderIds = (paidOrders || []).map((o) => o.id);
    let topProducts = [];
    if (paidOrderIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('quantity, price_cents, product_variants(product_id, products(id, name, slug))')
        .in('order_id', paidOrderIds);

      const productMap = {};
      for (const item of (items || [])) {
        const product = item.product_variants?.products;
        if (!product) continue;
        if (!productMap[product.id]) {
          productMap[product.id] = { id: product.id, name: product.name, slug: product.slug, units_sold: 0, revenue_cents: 0 };
        }
        productMap[product.id].units_sold += item.quantity;
        productMap[product.id].revenue_cents += (item.price_cents || 0) * item.quantity;
      }
      topProducts = Object.values(productMap)
        .sort((a, b) => b.units_sold - a.units_sold)
        .slice(0, 5);
    }

    return res.json({
      stats: {
        total_revenue_cents: totalRevenue,
        month_revenue_cents: monthRevenue,
        total_orders: totalOrders || 0,
        pending_orders: pendingCount || 0,
        total_products: totalProducts || 0,
      },
      daily_revenue: dailyRevenue,
      top_products: topProducts,
      recent_orders: recentOrders || [],
    });
  } catch (err) {
    console.error('[admin/dashboard GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/orders?status=&page=1&limit=20
// ─────────────────────────────────────────────────────────────
router.get('/orders', requireAdmin, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    // Build query for paginated orders
    let query = supabaseAdmin
      .from('orders')
      .select('id, created_at, status, subtotal_cents, shipping_name, shipping_email, stripe_payment_intent_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);

    const { data: orders, error: ordersErr, count } = await query;

    if (ordersErr) {
      console.error('[admin/orders]', ordersErr);
      return res.status(500).json({ error: 'Could not fetch orders' });
    }

    // Get item counts for each order
    const ordersWithCounts = await Promise.all(
      (orders || []).map(async (order) => {
        const { count: itemCount } = await supabaseAdmin
          .from('order_items')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', order.id);
        return { ...order, item_count: itemCount || 0 };
      })
    );

    // Compute stats from ALL orders (not just this page)
    const { data: allOrders } = await supabaseAdmin
      .from('orders')
      .select('status, subtotal_cents');

    const stats = {
      total: allOrders?.length || 0,
      paid: allOrders?.filter((o) => o.status === 'paid').length || 0,
      fulfilled: allOrders?.filter((o) => o.status === 'fulfilled').length || 0,
      revenue_cents: allOrders
        ?.filter((o) => ['paid', 'fulfilled'].includes(o.status))
        .reduce((sum, o) => sum + (o.subtotal_cents || 0), 0) || 0,
    };

    return res.json({ stats, orders: ordersWithCounts, total: count || 0 });
  } catch (err) {
    console.error('[admin/orders]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/orders/:id
// Fully enriched single order
// ─────────────────────────────────────────────────────────────
router.get('/orders/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Fetch order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // 2. Fetch order items
    const { data: rawItems } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: true });

    // 3. Enrich each item
    const items = await Promise.all(
      (rawItems || []).map(async (item) => {
        const { data: variant } = await supabaseAdmin
          .from('product_variants')
          .select('id, product_id, color_name, color_hex, size, price_cents')
          .eq('id', item.variant_id)
          .single();

        if (!variant) return { ...item, variant: null, product: null, thumbnailUrl: null };

        const { data: product } = await supabaseAdmin
          .from('products')
          .select('id, name, slug')
          .eq('id', variant.product_id)
          .single();

        const colorName = item.config?.color || variant.color_name;
        const { data: images } = await supabaseAdmin
          .from('product_images')
          .select('url')
          .eq('product_id', variant.product_id)
          .eq('angle', 'front')
          .eq('color_name', colorName)
          .limit(1);

        let thumbnailUrl = images?.[0]?.url || null;
        if (!thumbnailUrl) {
          const { data: fallback } = await supabaseAdmin
            .from('product_images')
            .select('url')
            .eq('product_id', variant.product_id)
            .eq('angle', 'front')
            .limit(1);
          thumbnailUrl = fallback?.[0]?.url || null;
        }

        // Fetch back mockup for the same color
        let backThumbnailUrl = null;
        const { data: backImages } = await supabaseAdmin
          .from('product_images')
          .select('url')
          .eq('product_id', variant.product_id)
          .eq('angle', 'back')
          .eq('color_name', colorName)
          .limit(1);
        backThumbnailUrl = backImages?.[0]?.url || null;
        if (!backThumbnailUrl) {
          const { data: backFallback } = await supabaseAdmin
            .from('product_images')
            .select('url')
            .eq('product_id', variant.product_id)
            .eq('angle', 'back')
            .limit(1);
          backThumbnailUrl = backFallback?.[0]?.url || thumbnailUrl;
        }

        // Signed download URLs (Content-Disposition: attachment)
        async function signDesignUrl(storagePath) {
          if (!storagePath) return null;
          const rawName = storagePath.split('/').pop().replace(/^\d+_/, '') || 'design';
          const { data } = await supabaseAdmin.storage
            .from('designs')
            .createSignedUrl(storagePath, 60 * 60, { download: rawName });
          return data?.signedUrl || null;
        }

        // Signed view URLs (inline display for <img> in admin)
        async function signDesignViewUrl(storagePath) {
          if (!storagePath) return null;
          const { data } = await supabaseAdmin.storage
            .from('designs')
            .createSignedUrl(storagePath, 60 * 60);
          return data?.signedUrl || null;
        }

        const frontDesignSignedUrl = await signDesignUrl(item.config?.front?.design_url);
        const backDesignSignedUrl  = await signDesignUrl(item.config?.back?.design_url);
        const frontDesignViewUrl   = await signDesignViewUrl(item.config?.front?.design_url);
        const backDesignViewUrl    = await signDesignViewUrl(item.config?.back?.design_url);

        return {
          ...item, variant, product: product || null,
          thumbnailUrl, backThumbnailUrl,
          frontDesignSignedUrl, backDesignSignedUrl,
          frontDesignViewUrl, backDesignViewUrl,
        };
      })
    );

    return res.json({ order, items });
  } catch (err) {
    console.error('[admin/orders/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/orders/:id/status
// Body: { status }
// ─────────────────────────────────────────────────────────────
router.patch('/orders/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const VALID_STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled'];
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[admin/orders/:id/status]', error);
      return res.status(500).json({ error: 'Could not update status' });
    }

    return res.json({ success: true, order: data });
  } catch (err) {
    console.error('[admin/orders/:id/status]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/orders/:id
// ─────────────────────────────────────────────────────────────
router.delete('/orders/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await supabaseAdmin.from('order_items').delete().eq('order_id', id);
    const { error } = await supabaseAdmin.from('orders').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Could not delete order' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin/orders DELETE]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ═════════════════════════════════════════════════════════════
// PRODUCT MANAGEMENT
// ═════════════════════════════════════════════════════════════

// Helper: auto-generate slug from name
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/products
// ─────────────────────────────────────────────────────────────
router.get('/products', requireAdmin, async (req, res) => {
  try {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id, slug, name, description, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Could not fetch products' });

    const enriched = await Promise.all(
      (products || []).map(async (p) => {
        const [{ count: variantCount }, { count: imageCount }] = await Promise.all([
          supabaseAdmin.from('product_variants').select('id', { count: 'exact', head: true }).eq('product_id', p.id),
          supabaseAdmin.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', p.id),
        ]);

        const { data: img } = await supabaseAdmin
          .from('product_images')
          .select('url')
          .eq('product_id', p.id)
          .eq('angle', 'front')
          .order('sort_order', { ascending: true })
          .limit(1);

        return { ...p, variantCount: variantCount || 0, imageCount: imageCount || 0, thumbnailUrl: img?.[0]?.url || null };
      })
    );

    return res.json(enriched);
  } catch (err) {
    console.error('[admin/products GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/products
// ─────────────────────────────────────────────────────────────
router.post('/products', requireAdmin, async (req, res) => {
  const { name, description, slug, category_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const finalSlug = slug?.trim() || toSlug(name);

  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({ name: name.trim(), description: description?.trim() || null, slug: finalSlug, category_id: category_id || null })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A product with this slug already exists' });
      return res.status(500).json({ error: 'Could not create product' });
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error('[admin/products POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/products/upload/sign
// Body: { productId, filename, contentType }
// Returns: { signedUrl, storagePath, publicUrl }
// Client PUTs file directly to Supabase Storage using signedUrl,
// then calls POST /products/:id/images with the publicUrl.
// ─────────────────────────────────────────────────────────────
router.post('/products/upload/sign', requireAdmin, async (req, res) => {
  const { productId, filename, contentType } = req.body;

  if (!productId || !filename || !contentType) {
    return res.status(400).json({ error: 'productId, filename and contentType are required' });
  }

  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!ALLOWED_TYPES.includes(contentType)) {
    return res.status(400).json({ error: 'File type not allowed. Use PNG, JPEG, WebP or GIF.' });
  }

  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${productId}/${Date.now()}_${sanitizedFilename}`;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from('product-images')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('[products/upload/sign]', error);
      return res.status(500).json({ error: 'Could not create signed URL' });
    }

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath}`;

    return res.json({ signedUrl: data.signedUrl, storagePath, publicUrl });
  } catch (err) {
    console.error('[products/upload/sign]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/products/:id
// ─────────────────────────────────────────────────────────────
router.patch('/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, slug, category_id } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (slug !== undefined) updates.slug = slug.trim();
  if (category_id !== undefined) updates.category_id = category_id || null;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Slug already in use' });
      return res.status(500).json({ error: 'Could not update product' });
    }

    return res.json(data);
  } catch (err) {
    console.error('[admin/products PATCH]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/products/:id
// ─────────────────────────────────────────────────────────────
router.delete('/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Could not delete product' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin/products DELETE]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/products/:id  (full detail for edit form)
// ─────────────────────────────────────────────────────────────
router.get('/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { data: product, error: pErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (pErr || !product) return res.status(404).json({ error: 'Product not found' });

    const [{ data: variants }, { data: images }] = await Promise.all([
      supabaseAdmin.from('product_variants').select('*').eq('product_id', id).order('color_name').order('size'),
      supabaseAdmin.from('product_images').select('*').eq('product_id', id).order('sort_order'),
    ]);

    return res.json({ product, variants: variants || [], images: images || [] });
  } catch (err) {
    console.error('[admin/products/:id GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/products/:id/variants/bulk
// Body: { colors: [{name, hex}], sizes: [string], price_cents, sku_prefix? }
// ─────────────────────────────────────────────────────────────
router.post('/products/:id/variants/bulk', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { colors, sizes, price_cents, sku_prefix } = req.body;

  if (!colors?.length || !sizes?.length || !price_cents) {
    return res.status(400).json({ error: 'colors, sizes, and price_cents are required' });
  }

  try {
    // Fetch existing variants for this product to avoid duplicates
    const { data: existing } = await supabaseAdmin
      .from('product_variants')
      .select('color_name, size')
      .eq('product_id', id);

    const existingSet = new Set(
      (existing || []).map((v) => `${v.color_name}|${v.size}`)
    );

    const rows = [];
    for (const color of colors) {
      for (const size of sizes) {
        // Skip combos that already exist
        if (existingSet.has(`${color.name}|${size}`)) continue;

        const colorAbbrev = color.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        const uniquePrefix = id.slice(-8).toUpperCase(); // last 8 chars of UUID for uniqueness
        const sku = sku_prefix
          ? `${sku_prefix}-${colorAbbrev}-${size}`
          : `${uniquePrefix}-${colorAbbrev}-${size}`;

        rows.push({
          product_id: id,
          color_name: color.name,
          color_hex: color.hex || null,
          size,
          price_cents: parseInt(price_cents),
          sku,
          stock: null, // null = unlimited by default
        });
      }
    }

    if (rows.length === 0) {
      return res.status(201).json({ inserted: 0, variants: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('product_variants')
      .insert(rows)
      .select();

    if (error) {
      console.error('[variants/bulk]', error);
      return res.status(500).json({ error: `Could not create variants: ${error.message}` });
    }

    return res.status(201).json({ inserted: data?.length || 0, variants: data || [] });
  } catch (err) {
    console.error('[variants/bulk]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/products/:id/variants/:variantId
// Body: { stock }  (null = unlimited, 0 = OOS, n = qty)
// ─────────────────────────────────────────────────────────────
router.patch('/products/:id/variants/:variantId', requireAdmin, async (req, res) => {
  const { variantId } = req.params;
  const { stock } = req.body;

  // stock must be null or a non-negative integer
  if (stock !== null && stock !== undefined) {
    const n = parseInt(stock, 10);
    if (isNaN(n) || n < 0) {
      return res.status(400).json({ error: 'stock must be null or a non-negative integer' });
    }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('product_variants')
      .update({ stock: stock === '' || stock === undefined ? null : stock === null ? null : parseInt(stock, 10) })
      .eq('id', variantId)
      .select()
      .single();

    if (error) {
      console.error('[variants PATCH]', error);
      return res.status(500).json({ error: 'Could not update variant' });
    }
    return res.json(data);
  } catch (err) {
    console.error('[variants PATCH]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/products/:id/variants/:variantId
// ─────────────────────────────────────────────────────────────
router.delete('/products/:id/variants/:variantId', requireAdmin, async (req, res) => {
  const { variantId } = req.params;
  try {
    const { error } = await supabaseAdmin.from('product_variants').delete().eq('id', variantId);
    if (error) return res.status(500).json({ error: 'Could not delete variant' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[variants DELETE]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/products/:id/images
// Body: { url, color_name?, angle, sort_order? }
// ─────────────────────────────────────────────────────────────
router.post('/products/:id/images', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { url, color_name, angle = 'front', sort_order = 0 } = req.body;

  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const { data, error } = await supabaseAdmin
      .from('product_images')
      .insert({ product_id: id, url, color_name: color_name || null, angle, sort_order })
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Could not add image' });
    return res.status(201).json(data);
  } catch (err) {
    console.error('[images POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/products/:id/images/:imageId
// ─────────────────────────────────────────────────────────────
router.delete('/products/:id/images/:imageId', requireAdmin, async (req, res) => {
  const { imageId } = req.params;
  try {
    // Fetch the image record first so we can clean up storage
    const { data: img } = await supabaseAdmin
      .from('product_images')
      .select('url')
      .eq('id', imageId)
      .single();

    const { error } = await supabaseAdmin.from('product_images').delete().eq('id', imageId);
    if (error) return res.status(500).json({ error: 'Could not delete image' });

    // If the URL points to our product-images bucket, remove the file from storage
    if (img?.url) {
      const marker = '/storage/v1/object/public/product-images/';
      const idx = img.url.indexOf(marker);
      if (idx !== -1) {
        const storagePath = img.url.slice(idx + marker.length);
        await supabaseAdmin.storage.from('product-images').remove([storagePath]);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[images DELETE]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ═════════════════════════════════════════════════════════════
// Category management
// ═════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// POST /api/admin/categories/upload/sign
// Body: { filename, contentType }
// Returns: { signedUrl, publicUrl }
// ─────────────────────────────────────────────────────────────
router.post('/categories/upload/sign', requireAdmin, async (req, res) => {
  const { filename, contentType } = req.body;

  if (!filename || !contentType) {
    return res.status(400).json({ error: 'filename and contentType are required' });
  }

  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!ALLOWED_TYPES.includes(contentType)) {
    return res.status(400).json({ error: 'File type not allowed. Use PNG, JPEG, WebP or GIF.' });
  }

  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `categories/${Date.now()}_${sanitizedFilename}`;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from('product-images')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('[categories/upload/sign]', error);
      return res.status(500).json({ error: 'Could not create signed URL' });
    }

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath}`;
    return res.json({ signedUrl: data.signedUrl, publicUrl });
  } catch (err) {
    console.error('[categories/upload/sign]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/categories
// ─────────────────────────────────────────────────────────────
router.get('/categories', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('id, slug, name, image_url, sort_order, created_at')
      .order('sort_order', { ascending: true });

    if (error) return res.status(500).json({ error: 'Could not fetch categories' });
    return res.json(data || []);
  } catch (err) {
    console.error('[admin/categories GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/categories
// Body: { name, slug?, image_url?, sort_order? }
// ─────────────────────────────────────────────────────────────
router.post('/categories', requireAdmin, async (req, res) => {
  const { name, slug, image_url, sort_order } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const finalSlug = slug?.trim() || name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        name: name.trim(),
        slug: finalSlug,
        image_url: image_url?.trim() || null,
        sort_order: sort_order !== undefined ? parseInt(sort_order) : 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A category with this slug already exists' });
      return res.status(500).json({ error: 'Could not create category' });
    }
    return res.status(201).json(data);
  } catch (err) {
    console.error('[admin/categories POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/categories/:id
// Body: { name?, slug?, image_url?, sort_order? }
// ─────────────────────────────────────────────────────────────
router.patch('/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, slug, image_url, sort_order } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (slug !== undefined) updates.slug = slug.trim();
  if (image_url !== undefined) updates.image_url = image_url?.trim() || null;
  if (sort_order !== undefined) updates.sort_order = parseInt(sort_order);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Slug already in use' });
      return res.status(500).json({ error: 'Could not update category' });
    }
    return res.json(data);
  } catch (err) {
    console.error('[admin/categories PATCH]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/categories/:id
// Products with this category will have category_id set to NULL
// ─────────────────────────────────────────────────────────────
router.delete('/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin.from('categories').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Could not delete category' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin/categories DELETE]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
