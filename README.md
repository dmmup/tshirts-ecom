# PrintShop – Custom T-Shirt E-commerce

Full-stack e-commerce app with a Product Detail Page (PDP) for custom printed apparel.

**Stack:** React + Vite + Tailwind · Node.js/Express · Supabase (DB + Auth + Storage)

---

## Project Structure

```
Ecom_TShirt/
├── frontend/               React app (Vite + Tailwind)
│   ├── src/
│   │   ├── api/
│   │   │   └── products.js      API client (fetch, upload, cart)
│   │   ├── pages/
│   │   │   └── ProductDetailPage.jsx  Main PDP component
│   │   ├── App.jsx              Router (BrowserRouter + routes)
│   │   └── main.jsx             Entry point
│   ├── .env.example
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/                Express API server
│   ├── routes/
│   │   └── products.js     GET product, POST upload/sign, POST upload/confirm, POST cart/items
│   ├── server.js           Entry point (CORS, routes)
│   └── .env.example
│
└── supabase/
    └── migrations/
        └── 20240101_pdp_schema.sql  Tables, RLS, storage bucket, seed data
```

---

## Quick Start

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. In **SQL Editor**, run the full migration:
   ```
   supabase/migrations/20240101_pdp_schema.sql
   ```
   This creates all tables, RLS policies, the `designs` storage bucket, and seed data.

3. Copy your **Project URL** and keys from **Settings → API**.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev     # starts on http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
# VITE_API_URL defaults to /api (proxied by Vite to localhost:3001)
npm install
npm run dev     # starts on http://localhost:5173
```

Visit `http://localhost:5173/products/gildan-budget-unisex-tshirt` to see the PDP.

---

## Environment Variables

### `frontend/.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base (default `/api`, proxied in dev) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (safe for browser) |

### `backend/.env`

| Variable | Description |
|---|---|
| `PORT` | Server port (default `3001`) |
| `FRONTEND_URL` | Allowed CORS origin (default `http://localhost:5173`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** – never expose to frontend |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/products/:slug` | Product + variants + images |
| `POST` | `/api/products/upload/sign` | Get signed upload URL for Supabase Storage |
| `POST` | `/api/products/upload/confirm` | Verify upload + create audit record + return preview URL |
| `POST` | `/api/products/cart/items` | Add item to cart (creates cart if needed) |
| `GET` | `/api/health` | Health check |

---

## PDP Features

| Feature | Details |
|---|---|
| Gallery | Main image + thumbnails; swaps automatically when color changes |
| Color swatches | Dot buttons derived from variants; selecting resets size |
| Backside toggle | Blank / Color (stored in cart item config) |
| Decoration cards | DTG / Embroidery / Screen Print |
| Size grid | Only sizes available for selected color shown |
| Price | Range when no size selected; exact price when variant resolved |
| Design upload | Drag & drop; progress bar; signed URL flow (file never passes through backend) |
| Add to Cart | Stores full config (color, size, backside, decoration, design URL) as JSONB |
| Anonymous cart | `anonymous_id` persisted in `localStorage`; survives page refresh |
| Toast feedback | Slide-up notification on add-to-cart success/error |

---

## Upload Flow (Signed URL)

```
Frontend                    Backend (service role)         Supabase Storage
   │                              │                              │
   │── POST /upload/sign ────────►│                              │
   │                              │── createSignedUploadUrl ────►│
   │◄── { signedUrl, path } ──────│◄─────────────────────────────│
   │                              │                              │
   │── PUT signedUrl (file) ──────────────────────────────────► │
   │                              │                              │
   │── POST /upload/confirm ─────►│                              │
   │                              │── list() verify existence ──►│
   │                              │── insert design_uploads      │
   │                              │── createSignedUrl (read) ───►│
   │◄── { previewUrl } ───────────│◄─────────────────────────────│
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `products` | Product master data |
| `product_variants` | One row per color × size |
| `product_images` | Images by color + angle (front/back/side/detail) |
| `carts` | Shopping carts (user or anonymous) |
| `cart_items` | Line items with config JSONB |
| `design_uploads` | Audit trail for uploaded design files |

Storage bucket: `designs` (private), path: `designs/{ownerId}/{timestamp}_{filename}`

---

## Extending

- **Real mockup images**: Replace `placehold.co` URLs in the seed SQL with actual CDN image URLs
- **Auth**: Pass `userId` from Supabase Auth session instead of `anonymousId`; backend merges carts
- **Cart page**: Read `cart_items` for the user's current cart from Supabase
- **Generate Templates**: Wire the button to your mockup/template generation service
- **Size guide modal**: Add a modal triggered by the "Size guide" link in `SizeSelector`
