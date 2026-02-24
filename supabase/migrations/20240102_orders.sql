-- Migration: Orders + Order Items
-- Run this in Supabase SQL editor or via supabase db push

-- ── orders ───────────────────────────────────────────────────
create table if not exists orders (
  id                        uuid primary key default gen_random_uuid(),
  cart_id                   uuid references carts(id),
  anonymous_id              text,
  user_id                   uuid,
  status                    text not null default 'pending',
    -- pending | paid | fulfilled | cancelled
  subtotal_cents            integer not null,
  stripe_payment_intent_id  text unique,
  shipping_name             text,
  shipping_email            text,
  shipping_line1            text,
  shipping_line2            text,
  shipping_city             text,
  shipping_state            text,
  shipping_postal_code      text,
  shipping_country          text default 'US',
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

create index if not exists orders_anonymous_id_idx on orders(anonymous_id);
create index if not exists orders_stripe_pi_idx    on orders(stripe_payment_intent_id);

-- ── order_items ──────────────────────────────────────────────
create table if not exists order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  variant_id   uuid references product_variants(id),
  quantity     integer not null default 1,
  price_cents  integer not null,
  config       jsonb default '{}',
  created_at   timestamptz default now()
);

create index if not exists order_items_order_id_idx on order_items(order_id);

-- ── RLS (disable for service-role-only access) ───────────────
alter table orders      enable row level security;
alter table order_items enable row level security;

-- Service role bypasses RLS automatically; no extra policies needed
-- for server-side operations. Add user-facing policies if auth is added.
