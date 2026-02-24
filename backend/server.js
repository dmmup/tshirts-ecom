// backend/server.js
// ─────────────────────────────────────────────────────────────
// Express server entry point
// ─────────────────────────────────────────────────────────────

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Webhook (raw body — must come BEFORE express.json) ────────
const { router: checkoutRouter, handleWebhook } = require('./routes/checkout');
app.post('/api/checkout/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
const productsRouter = require('./routes/products');
const cartRouter = require('./routes/cart');

// Products: GET /api/products/:slug
// Upload:   POST /api/products/upload/sign
//           POST /api/products/upload/confirm
// Cart add: POST /api/products/cart/items
app.use('/api/products', productsRouter);

// Cart:     GET    /api/cart?anonymousId=
//           PATCH  /api/cart/items/:itemId
//           DELETE /api/cart/items/:itemId
app.use('/api/cart', cartRouter);

// Checkout: POST /api/checkout/create-payment-intent
//           POST /api/checkout/webhook (handled above with raw body)
app.use('/api/checkout', checkoutRouter);

// Admin:    POST /api/admin/verify
//           GET  /api/admin/orders
//           GET  /api/admin/orders/:id
//           PATCH /api/admin/orders/:id/status
const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
