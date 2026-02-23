// src/pages/CartPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchCart, updateCartItem, removeCartItem } from '../api/products';

// ── Helpers ───────────────────────────────────────────────────
function getAnonymousId() {
  return localStorage.getItem('pdp_anon_id');
}

function formatPrice(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const DECORATION_LABELS = {
  dtg: 'DTG Print',
  embroidery: 'Embroidery',
  screen: 'Screen Print',
};

// ── Toast ─────────────────────────────────────────────────────
function Toast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-slate-900 text-white text-sm rounded-xl shadow-lg flex items-center gap-3">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-slate-400 hover:text-white">✕</button>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────
function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <svg className="w-20 h-20 text-slate-200 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Your cart is empty</h2>
      <p className="text-slate-500 text-sm mb-8">Add a custom design to get started.</p>
      <Link
        to="/products/gildan-budget-unisex-tshirt"
        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
      >
        Start designing
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
    </div>
  );
}

// ── Item Card ─────────────────────────────────────────────────
function ItemCard({ item, onQuantityChange, onRemove }) {
  const { variant, product, thumbnailUrl, config, quantity } = item;
  const [imgError, setImgError] = useState(false);
  const [designImgError, setDesignImgError] = useState(false);

  const price = variant?.price_cents ?? 0;
  const lineTotal = price * quantity;
  const colorHex = variant?.color_hex || '#e2e8f0';
  const decorationLabel = DECORATION_LABELS[config?.decoration] || config?.decoration || '—';

  return (
    <div className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-24 h-28 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
        {thumbnailUrl && !imgError ? (
          <img
            src={thumbnailUrl}
            alt={product?.name || 'Product'}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {product ? (
              <Link
                to={`/products/${product.slug}`}
                className="font-semibold text-slate-800 hover:text-indigo-600 transition-colors text-sm leading-snug line-clamp-2"
              >
                {product.name}
              </Link>
            ) : (
              <p className="font-semibold text-slate-800 text-sm">Custom T-Shirt</p>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {config?.color && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-slate-300 flex-shrink-0"
                    style={{ backgroundColor: colorHex }}
                  />
                  {config.color}
                </span>
              )}
              {config?.size && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                  {config.size}
                </span>
              )}
              {config?.decoration && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
                  {decorationLabel}
                </span>
              )}
            </div>
          </div>

          {/* Remove button */}
          <button
            onClick={() => onRemove(item.id)}
            className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Remove item"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Design preview */}
        {config?.design_preview_url && !designImgError && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Design:</span>
            <img
              src={config.design_preview_url}
              alt="Design preview"
              className="h-8 w-8 rounded object-contain bg-slate-50 border border-slate-200"
              onError={() => setDesignImgError(true)}
            />
          </div>
        )}

        {/* Quantity + price row */}
        <div className="flex items-center justify-between mt-auto pt-1">
          {/* Stepper */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => quantity > 1 && onQuantityChange(item.id, quantity - 1)}
              disabled={quantity <= 1}
              className="px-2.5 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              −
            </button>
            <span className="px-3 py-1 text-sm font-semibold text-slate-800 border-x border-slate-200 min-w-[2.5rem] text-center">
              {quantity}
            </span>
            <button
              onClick={() => onQuantityChange(item.id, quantity + 1)}
              className="px-2.5 py-1 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              +
            </button>
          </div>

          {/* Price */}
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">{formatPrice(lineTotal)}</p>
            {quantity > 1 && (
              <p className="text-xs text-slate-400">{formatPrice(price)} each</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Order Summary ─────────────────────────────────────────────
function OrderSummary({ items, onCheckout }) {
  const subtotal = items.reduce((acc, item) => acc + (item.variant?.price_cents ?? 0) * item.quantity, 0);
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4 sticky top-24">
      <h2 className="font-bold text-slate-900 text-base">Order summary</h2>

      <div className="flex justify-between text-sm text-slate-600">
        <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
        <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
      </div>

      <div className="flex justify-between text-sm text-slate-600">
        <span>Shipping</span>
        <span className="text-green-600 font-medium">Calculated at checkout</span>
      </div>

      <div className="border-t border-slate-100 pt-4 flex justify-between font-bold text-slate-900">
        <span>Total</span>
        <span>{formatPrice(subtotal)}</span>
      </div>

      <button
        onClick={onCheckout}
        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm active:scale-[0.98]"
      >
        Proceed to checkout
      </button>

      <Link
        to="/products/gildan-budget-unisex-tshirt"
        className="text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
      >
        ← Continue shopping
      </Link>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-100 animate-pulse">
      <div className="flex-shrink-0 w-24 h-28 rounded-xl bg-slate-100" />
      <div className="flex-1 flex flex-col gap-3 py-1">
        <div className="h-4 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="h-3 bg-slate-100 rounded w-1/3" />
        <div className="flex justify-between mt-auto">
          <div className="h-8 bg-slate-100 rounded-lg w-24" />
          <div className="h-5 bg-slate-100 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function CartPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => setToast(msg), []);
  const dismissToast = useCallback(() => setToast(null), []);

  // Load cart on mount
  useEffect(() => {
    const anonymousId = getAnonymousId();
    fetchCart(anonymousId)
      .then(({ items: fetched }) => setItems(fetched || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Optimistic quantity update
  const handleQuantityChange = useCallback(async (itemId, newQty) => {
    const prev = items;
    setItems((cur) => cur.map((it) => it.id === itemId ? { ...it, quantity: newQty } : it));
    try {
      await updateCartItem(itemId, newQty);
    } catch {
      setItems(prev);
      showToast('Could not update quantity. Please try again.');
    }
  }, [items, showToast]);

  // Remove item
  const handleRemove = useCallback(async (itemId) => {
    const prev = items;
    setItems((cur) => cur.filter((it) => it.id !== itemId));
    try {
      await removeCartItem(itemId);
    } catch {
      setItems(prev);
      showToast('Could not remove item. Please try again.');
    }
  }, [items, showToast]);

  // Checkout placeholder
  const handleCheckout = useCallback(() => {
    showToast('Checkout coming soon!');
  }, [showToast]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Minimal top bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-slate-900 tracking-tight">
            Print<span className="text-indigo-600">Shop</span>
          </Link>
          <Link
            to="/products/gildan-budget-unisex-tshirt"
            className="text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium"
          >
            ← Continue shopping
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-8">
          Your cart
          {!loading && items.length > 0 && (
            <span className="ml-2 text-base font-normal text-slate-400">
              ({items.reduce((a, i) => a + i.quantity, 0)} {items.reduce((a, i) => a + i.quantity, 0) === 1 ? 'item' : 'items'})
            </span>
          )}
        </h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid lg:grid-cols-[1fr_340px] gap-8">
            <div className="flex flex-col gap-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="hidden lg:block h-64 bg-white rounded-2xl border border-slate-100 animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
            {/* Item list */}
            <div className="flex flex-col gap-4">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onQuantityChange={handleQuantityChange}
                  onRemove={handleRemove}
                />
              ))}
            </div>

            {/* Order summary */}
            <OrderSummary items={items} onCheckout={handleCheckout} />
          </div>
        )}
      </main>

      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
}
