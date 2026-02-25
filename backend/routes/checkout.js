// backend/routes/checkout.js
// ─────────────────────────────────────────────────────────────
// Checkout Routes
// Mounted at: /api/checkout
// Webhook:    POST /api/checkout/webhook (raw body, in server.js)
// ─────────────────────────────────────────────────────────────

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────
// POST /api/checkout/create-payment-intent
// Body: { anonymousId, shipping? }
// Returns: { clientSecret, totalCents, cartId }
// ─────────────────────────────────────────────────────────────
router.post('/create-payment-intent', async (req, res) => {
  const { anonymousId, shipping } = req.body;

  if (!anonymousId) {
    return res.status(400).json({ error: 'anonymousId is required' });
  }

  // Optionally identify the authenticated user
  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data: { user } } = await supabaseAdmin.auth.getUser(token).catch(() => ({ data: {} }));
    userId = user?.id ?? null;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured on the server.' });
  }

  try {
    // 1. Find cart
    const { data: cart, error: cartErr } = await supabaseAdmin
      .from('carts')
      .select('id')
      .eq('anonymous_id', anonymousId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cartErr || !cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    // 2. Fetch cart items
    const { data: cartItems, error: itemsErr } = await supabaseAdmin
      .from('cart_items')
      .select('id, quantity, config, variant_id')
      .eq('cart_id', cart.id);

    if (itemsErr || !cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // 3. Fetch variant prices
    const variantIds = [...new Set(cartItems.map((i) => i.variant_id))];
    const { data: variants } = await supabaseAdmin
      .from('product_variants')
      .select('id, price_cents')
      .in('id', variantIds);

    const priceMap = {};
    (variants || []).forEach((v) => { priceMap[v.id] = v.price_cents; });

    // 4. Calculate total
    const totalCents = cartItems.reduce(
      (sum, item) => sum + (priceMap[item.variant_id] || 0) * item.quantity,
      0
    );

    if (totalCents < 50) {
      return res.status(400).json({ error: 'Order total is below the minimum ($0.50)' });
    }

    // 5. Check for an existing pending order/PaymentIntent for this cart
    const { data: existingOrder } = await supabaseAdmin
      .from('orders')
      .select('id, stripe_payment_intent_id')
      .eq('cart_id', cart.id)
      .eq('status', 'pending')
      .maybeSingle();

    let paymentIntent;

    if (existingOrder?.stripe_payment_intent_id) {
      // Reuse + sync amount in case cart changed
      paymentIntent = await stripe.paymentIntents.update(
        existingOrder.stripe_payment_intent_id,
        { amount: totalCents }
      );

      // Update shipping on existing order
      if (shipping) {
        await supabaseAdmin
          .from('orders')
          .update({
            subtotal_cents: totalCents,
            shipping_name: shipping.name || null,
            shipping_email: shipping.email || null,
            shipping_line1: shipping.line1 || null,
            shipping_line2: shipping.line2 || null,
            shipping_city: shipping.city || null,
            shipping_state: shipping.state || null,
            shipping_postal_code: shipping.postal_code || null,
            shipping_country: shipping.country || 'US',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingOrder.id);
      }
    } else {
      // Create new PaymentIntent
      paymentIntent = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: { cartId: cart.id, anonymousId },
        ...(shipping?.email && { receipt_email: shipping.email }),
      });

      // Create pending order record
      const { data: newOrder, error: orderErr } = await supabaseAdmin
        .from('orders')
        .insert({
          cart_id: cart.id,
          anonymous_id: anonymousId,
          user_id: userId,
          status: 'pending',
          subtotal_cents: totalCents,
          stripe_payment_intent_id: paymentIntent.id,
          shipping_name: shipping?.name || null,
          shipping_email: shipping?.email || null,
          shipping_line1: shipping?.line1 || null,
          shipping_line2: shipping?.line2 || null,
          shipping_city: shipping?.city || null,
          shipping_state: shipping?.state || null,
          shipping_postal_code: shipping?.postal_code || null,
          shipping_country: shipping?.country || 'US',
        })
        .select()
        .single();

      if (orderErr) {
        console.error('[checkout] Failed to create order record:', orderErr);
        // Non-fatal — still return clientSecret
      } else if (newOrder) {
        // Insert order items
        const orderItems = cartItems.map((item) => ({
          order_id: newOrder.id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          price_cents: priceMap[item.variant_id] || 0,
          config: item.config || {},
        }));
        const { error: oiErr } = await supabaseAdmin.from('order_items').insert(orderItems);
        if (oiErr) console.error('[checkout] Failed to insert order items:', oiErr);
      }
    }

    return res.json({
      clientSecret: paymentIntent.client_secret,
      totalCents,
      cartId: cart.id,
    });
  } catch (err) {
    console.error('[checkout/create-payment-intent]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Webhook handler (called from server.js with raw body)
// Handles: payment_intent.succeeded
// ─────────────────────────────────────────────────────────────
async function handleWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('[webhook] STRIPE_WEBHOOK_SECRET not set – skipping signature verification');
    return res.json({ received: true });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    try {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('stripe_payment_intent_id', pi.id);

      if (error) console.error('[webhook] Failed to update order status:', error);
      else console.log(`[webhook] Order paid for PI: ${pi.id}`);
    } catch (err) {
      console.error('[webhook] Unexpected error:', err);
    }
  }

  return res.json({ received: true });
}

module.exports = { router, handleWebhook };
