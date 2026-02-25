// backend/routes/account.js
// ─────────────────────────────────────────────────────────────
// Account Routes (authenticated customers)
// Mounted at: /api/account
// ─────────────────────────────────────────────────────────────

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Auth middleware ───────────────────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = user;
  next();
}

router.use(requireAuth);

// ─────────────────────────────────────────────────────────────
// GET /api/account/profile
// ─────────────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) {
      console.error('[GET /api/account/profile]', error);
      return res.status(500).json({ error: 'Could not fetch profile' });
    }

    return res.json(data || {});
  } catch (err) {
    console.error('[GET /api/account/profile]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/account/profile
// Body: { full_name?, default_shipping_* }
// ─────────────────────────────────────────────────────────────
router.patch('/profile', async (req, res) => {
  const allowed = [
    'full_name',
    'default_shipping_line1',
    'default_shipping_line2',
    'default_shipping_city',
    'default_shipping_state',
    'default_shipping_postal_code',
    'default_shipping_country',
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .upsert({ id: req.user.id, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) {
      console.error('[PATCH /api/account/profile]', error);
      return res.status(500).json({ error: 'Could not update profile' });
    }

    return res.json(data);
  } catch (err) {
    console.error('[PATCH /api/account/profile]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/account/orders
// Returns the authenticated user's orders with items enriched.
// ─────────────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    // Fetch orders for this user
    const { data: orders, error: ordersErr } = await supabaseAdmin
      .from('orders')
      .select('id, created_at, status, subtotal_cents, shipping_name, shipping_email, stripe_payment_intent_id')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (ordersErr) {
      console.error('[GET /api/account/orders]', ordersErr);
      return res.status(500).json({ error: 'Could not fetch orders' });
    }

    if (!orders || orders.length === 0) {
      return res.json([]);
    }

    // Enrich each order with items
    const enriched = await Promise.all(
      orders.map(async (order) => {
        const { data: items } = await supabaseAdmin
          .from('order_items')
          .select('id, quantity, price_cents, config, variant_id')
          .eq('order_id', order.id);

        const enrichedItems = await Promise.all(
          (items || []).map(async (item) => {
            const { data: variant } = await supabaseAdmin
              .from('product_variants')
              .select('id, color_name, color_hex, size, product_id')
              .eq('id', item.variant_id)
              .maybeSingle();

            let productName = null;
            if (variant?.product_id) {
              const { data: product } = await supabaseAdmin
                .from('products')
                .select('name, slug')
                .eq('id', variant.product_id)
                .maybeSingle();
              productName = product?.name ?? null;
            }

            return { ...item, variant: variant || null, productName };
          })
        );

        return { ...order, items: enrichedItems };
      })
    );

    return res.json(enriched);
  } catch (err) {
    console.error('[GET /api/account/orders]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
