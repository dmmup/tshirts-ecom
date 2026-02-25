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

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
            const totalFormatted = `$${(order.subtotal_cents / 100).toFixed(2)}`;

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
