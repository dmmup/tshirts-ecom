// backend/routes/checkout.js
// ─────────────────────────────────────────────────────────────
// Checkout Routes
// Mounted at: /api/checkout
// Webhook:    POST /api/checkout/webhook (raw body, in server.js)
// ─────────────────────────────────────────────────────────────

const express = require('express');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('WARNING: STRIPE_SECRET_KEY is not set. Checkout will be unavailable.');
}
const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────
// Helper: validate a promo code and return discount info
// Throws an error with .statusCode if invalid
// ─────────────────────────────────────────────────────────────
async function getPromoDiscount(code, subtotalCents) {
  const { data: promo, error } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .ilike('code', code.trim())
    .eq('active', true)
    .maybeSingle();

  if (error || !promo) {
    const err = new Error('Invalid promo code');
    err.statusCode = 404;
    throw err;
  }
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    const err = new Error('Promo code has expired');
    err.statusCode = 400;
    throw err;
  }
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
    const err = new Error('Promo code has been fully redeemed');
    err.statusCode = 400;
    throw err;
  }
  if (subtotalCents < promo.min_order_cents) {
    const min = `$${(promo.min_order_cents / 100).toFixed(2)}`;
    const err = new Error(`Minimum order of ${min} required for this code`);
    err.statusCode = 400;
    throw err;
  }

  const discountCents = promo.discount_type === 'percent'
    ? Math.round(subtotalCents * promo.discount_value / 100)
    : Math.min(promo.discount_value, subtotalCents);

  return { promo, discountCents };
}

// ─────────────────────────────────────────────────────────────
// POST /api/checkout/validate-promo
// Body: { code, subtotalCents }
// Returns: { valid, code, discountCents, discountType, discountValue }
// ─────────────────────────────────────────────────────────────
router.post('/validate-promo', async (req, res) => {
  const { code, subtotalCents } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });
  if (!subtotalCents || subtotalCents < 1) return res.status(400).json({ error: 'subtotalCents is required' });

  try {
    const { promo, discountCents } = await getPromoDiscount(code, subtotalCents);
    return res.json({
      valid: true,
      code: promo.code,
      discountCents,
      discountType: promo.discount_type,
      discountValue: promo.discount_value,
    });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/checkout/create-payment-intent
// Body: { anonymousId, shipping?, promoCode? }
// Returns: { clientSecret, totalCents, subtotalCents, discountCents, cartId }
// ─────────────────────────────────────────────────────────────
router.post('/create-payment-intent', async (req, res) => {
  const { anonymousId, shipping, promoCode } = req.body;

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

    // 4. Calculate subtotal
    const subtotalCents = cartItems.reduce(
      (sum, item) => sum + (priceMap[item.variant_id] || 0) * item.quantity,
      0
    );

    if (subtotalCents < 50) {
      return res.status(400).json({ error: 'Order total is below the minimum ($0.50)' });
    }

    // 4b. Apply promo code if provided
    let discountCents = 0;
    let appliedPromoCode = null;
    if (promoCode) {
      try {
        const { discountCents: dc, promo } = await getPromoDiscount(promoCode, subtotalCents);
        discountCents = dc;
        appliedPromoCode = promo.code;
      } catch (err) {
        return res.status(err.statusCode || 400).json({ error: err.message });
      }
    }
    const finalAmountCents = subtotalCents - discountCents;

    // 5. Check for an existing pending order/PaymentIntent for this cart
    const { data: existingOrder } = await supabaseAdmin
      .from('orders')
      .select('id, stripe_payment_intent_id')
      .eq('cart_id', cart.id)
      .eq('status', 'pending')
      .maybeSingle();

    let paymentIntent;

    if (existingOrder?.stripe_payment_intent_id) {
      // Reuse + sync amount in case cart or promo changed
      paymentIntent = await stripe.paymentIntents.update(
        existingOrder.stripe_payment_intent_id,
        { amount: finalAmountCents }
      );

      // Update order with latest shipping + promo info
      // Only write promo columns if a code was actually applied (avoids errors
      // when the DB migration hasn't been run yet).
      await supabaseAdmin
        .from('orders')
        .update({
          subtotal_cents: subtotalCents,
          ...(appliedPromoCode != null && { discount_cents: discountCents, promo_code: appliedPromoCode }),
          ...(shipping && {
            shipping_name: shipping.name || null,
            shipping_email: shipping.email || null,
            shipping_line1: shipping.line1 || null,
            shipping_line2: shipping.line2 || null,
            shipping_city: shipping.city || null,
            shipping_state: shipping.state || null,
            shipping_postal_code: shipping.postal_code || null,
            shipping_country: shipping.country || 'US',
          }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingOrder.id);
    } else {
      // Create new PaymentIntent
      paymentIntent = await stripe.paymentIntents.create({
        amount: finalAmountCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: { cartId: cart.id, anonymousId },
        ...(shipping?.email && { receipt_email: shipping.email }),
      });

      // Create pending order record
      // Only include promo columns when a code was applied (backward compat
      // with deployments where the migration hasn't been run yet).
      const { data: newOrder, error: orderErr } = await supabaseAdmin
        .from('orders')
        .insert({
          cart_id: cart.id,
          anonymous_id: anonymousId,
          user_id: userId,
          status: 'pending',
          subtotal_cents: subtotalCents,
          ...(appliedPromoCode != null && { discount_cents: discountCents, promo_code: appliedPromoCode }),
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
      totalCents: finalAmountCents,
      subtotalCents,
      discountCents,
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
      // 1. Mark order as paid
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('stripe_payment_intent_id', pi.id)
        .select('id, shipping_name, shipping_email, shipping_line1, shipping_line2, shipping_city, shipping_state, shipping_postal_code, shipping_country, subtotal_cents')
        .single();

      if (error) {
        console.error('[webhook] Failed to update order status:', error);
      } else {
        console.log(`[webhook] Order paid for PI: ${pi.id}`);

        // Increment promo code uses_count if one was applied (requires migration)
        // Look up the promo_code on the order separately to avoid SELECT errors
        // when the column may not exist yet.
        try {
          const { data: orderPromo } = await supabaseAdmin
            .from('orders')
            .select('promo_code')
            .eq('id', order.id)
            .maybeSingle();
          if (orderPromo?.promo_code) {
            const { data: promo } = await supabaseAdmin
              .from('promo_codes')
              .select('id, uses_count')
              .ilike('code', orderPromo.promo_code)
              .maybeSingle();
            if (promo) {
              await supabaseAdmin
                .from('promo_codes')
                .update({ uses_count: promo.uses_count + 1 })
                .eq('id', promo.id);
            }
          }
        } catch (promoErr) {
          // Non-fatal — promo columns may not exist yet (migration pending)
        }

        // 2. Send confirmation email if we have an email address and SMTP is configured
        if (order?.shipping_email && process.env.SMTP_HOST && process.env.SMTP_USER) {
          try {
            // Fetch order items with product names
            const { data: items } = await supabaseAdmin
              .from('order_items')
              .select('quantity, price_cents, config, product_variants(size, color, products(name))')
              .eq('order_id', order.id);

            const storeName = process.env.STORE_NAME || 'PrintShop';
            const orderRef = order.id.slice(0, 8).toUpperCase();
            // pi.amount is the actual amount charged by Stripe (already includes any discount)
            const totalFormatted = `$${(pi.amount / 100).toFixed(2)}`;

            const itemRows = (items || []).map((item) => {
              const name = item.product_variants?.products?.name || 'Custom T-Shirt';
              const size = item.product_variants?.size || '';
              const color = item.product_variants?.color || '';
              const lineTotal = `$${((item.price_cents * item.quantity) / 100).toFixed(2)}`;
              return `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#1e293b">
                    ${name}${size ? ` — ${size}` : ''}${color ? ` / ${color}` : ''}
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;text-align:center">×${item.quantity}</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#1e293b;text-align:right">${lineTotal}</td>
                </tr>`;
            }).join('');

            const shippingLines = [
              order.shipping_name,
              order.shipping_line1,
              order.shipping_line2,
              [order.shipping_city, order.shipping_state, order.shipping_postal_code].filter(Boolean).join(', '),
              order.shipping_country,
            ].filter(Boolean).join('<br>');

            await transporter.sendMail({
              from: process.env.SMTP_FROM || `"${storeName}" <${process.env.SMTP_USER}>`,
              to: order.shipping_email,
              subject: `Order confirmed — ${storeName} #${orderRef}`,
              text: `Thanks for your order!\n\nOrder #${orderRef}\nTotal: ${totalFormatted}\n\nWe'll send you a shipping update when your order is on its way.`,
              html: `
                <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
                  <div style="background:#4f46e5;padding:32px;text-align:center;border-radius:8px 8px 0 0">
                    <h1 style="color:#fff;margin:0;font-size:22px">${storeName}</h1>
                  </div>
                  <div style="padding:32px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
                    <h2 style="margin:0 0 8px;font-size:20px">Order confirmed!</h2>
                    <p style="color:#64748b;margin:0 0 24px">Thanks, ${order.shipping_name?.split(' ')[0] || 'there'}. We've received your order and will start printing right away.</p>

                    <div style="background:#f8fafc;border-radius:6px;padding:16px;margin-bottom:24px">
                      <p style="margin:0;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Order reference</p>
                      <p style="margin:4px 0 0;font-size:20px;font-weight:700;letter-spacing:.1em;color:#4f46e5">#${orderRef}</p>
                    </div>

                    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
                      <thead>
                        <tr>
                          <th style="text-align:left;font-size:12px;color:#94a3b8;font-weight:600;padding-bottom:8px;text-transform:uppercase">Item</th>
                          <th style="text-align:center;font-size:12px;color:#94a3b8;font-weight:600;padding-bottom:8px;text-transform:uppercase">Qty</th>
                          <th style="text-align:right;font-size:12px;color:#94a3b8;font-weight:600;padding-bottom:8px;text-transform:uppercase">Price</th>
                        </tr>
                      </thead>
                      <tbody>${itemRows}</tbody>
                    </table>

                    <div style="text-align:right;padding-top:12px;border-top:2px solid #e2e8f0">
                      <span style="font-size:15px;font-weight:700">Total: ${totalFormatted}</span>
                    </div>

                    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9">
                      <p style="font-size:13px;color:#94a3b8;margin:0 0 6px;text-transform:uppercase;letter-spacing:.05em">Shipping to</p>
                      <p style="margin:0;line-height:1.6;color:#475569;font-size:14px">${shippingLines}</p>
                    </div>

                    <div style="margin-top:28px;background:#f0fdf4;border-radius:6px;padding:16px">
                      <p style="margin:0;font-size:14px;color:#166534">
                        Printed &amp; shipped within <strong>48 hours</strong>. You'll receive a tracking number by email once dispatched.
                      </p>
                    </div>

                    <p style="margin-top:28px;font-size:13px;color:#94a3b8;text-align:center">
                      Questions? Reply to this email or visit your <a href="${process.env.FRONTEND_URL}/account" style="color:#4f46e5">account page</a>.
                    </p>
                  </div>
                </div>
              `,
            });
            console.log(`[webhook] Confirmation email sent to ${order.shipping_email}`);
          } catch (mailErr) {
            console.error('[webhook] Failed to send confirmation email:', mailErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[webhook] Unexpected error:', err);
    }
  }

  return res.json({ received: true });
}

module.exports = { router, handleWebhook };
