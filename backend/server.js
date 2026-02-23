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
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
const productsRouter = require('./routes/products');

// Products: GET /api/products/:slug
// Upload:   POST /api/products/upload/sign
//           POST /api/products/upload/confirm
// Cart:     POST /api/products/cart/items
app.use('/api/products', productsRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
