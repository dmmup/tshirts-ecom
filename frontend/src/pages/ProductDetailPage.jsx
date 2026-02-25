// src/pages/ProductDetailPage.jsx
// ─────────────────────────────────────────────────────────────
// Product Detail Page (PDP)
// Route: /products/:slug
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchProduct, fetchRelatedProducts, fetchReviews, submitReview, uploadDesign, addToCart, fetchCart, removeCartItem, updateCartItem } from '../api/products';
import DesignPreview, { makeDefaultPlacement } from '../components/DesignPreview';
import { useAuth } from '../context/AuthContext';

// ── Helpers ──────────────────────────────────────────────────

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
const ALLOWED_TYPES = ['image/png', 'image/svg+xml'];
const MAX_DESIGN_MB = 10;

function sortSizes(sizes) {
  return [...sizes].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
}

function formatPrice(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function getAnonymousId() {
  const key = 'pdp_anon_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `anon_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

// ── Star Rating ───────────────────────────────────────────────
function StarRating({ rating, count }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-2">
      <div className="flex text-amber-400">
        {Array.from({ length: 5 }, (_, i) => (
          <svg key={i} className="w-4 h-4" fill={i < full ? 'currentColor' : i === full && half ? 'url(#half)' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <defs>
              <linearGradient id="half"><stop offset="50%" stopColor="currentColor"/><stop offset="50%" stopColor="transparent"/></linearGradient>
            </defs>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
          </svg>
        ))}
      </div>
      <span className="text-sm text-slate-500">({count} reviews)</span>
    </div>
  );
}

// ── Design Picker ─────────────────────────────────────────────
// Library of up to 4 designs; each side (front/back) picks independently.
const MAX_DESIGNS = 4;

function DesignPicker({ library, side, sideDesigns, onAddFile, onApply, onRemove }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) { setError('Only PNG or SVG files are accepted.'); return; }
    if (f.size > MAX_DESIGN_MB * 1024 * 1024) { setError(`Max file size is ${MAX_DESIGN_MB} MB.`); return; }
    setError('');
    onAddFile(f);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Your Design</span>
        {library.length > 0 && (
          <span className="text-xs text-slate-400">{library.length}/{MAX_DESIGNS} uploaded</span>
        )}
      </div>

      {/* Empty state: prominent upload zone */}
      {library.length === 0 ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full py-8 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-2xl transition-all flex flex-col items-center gap-2.5 text-slate-400 hover:text-indigo-500 group"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">Upload your design</p>
            <p className="text-xs mt-0.5 opacity-75">PNG or SVG · max {MAX_DESIGN_MB} MB</p>
          </div>
        </button>
      ) : (
        /* Library thumbnails + add slot */
        <div className="flex flex-wrap gap-2 items-center">
          {library.map((design) => {
            const isActiveFront = sideDesigns.front?.localDesignUrl === design.localUrl;
            const isActiveBack  = sideDesigns.back?.localDesignUrl  === design.localUrl;
            const isActiveSide  = side === 'front' ? isActiveFront : isActiveBack;
            return (
              <div key={design.id} className="relative group">
                <button
                  onClick={() => onApply(design)}
                  title={design.file.name}
                  className={`w-16 h-16 rounded-xl border-2 overflow-hidden bg-slate-50 flex items-center justify-center transition-all ${
                    isActiveSide ? 'border-indigo-500 shadow-md shadow-indigo-100' : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <img src={design.localUrl} alt={design.file.name} className="w-full h-full object-contain p-1" />
                </button>
                <div className="absolute -bottom-1 left-0 right-0 flex justify-center gap-0.5">
                  {isActiveFront && <span className="text-[9px] font-bold bg-indigo-600 text-white px-1 rounded">F</span>}
                  {isActiveBack  && <span className="text-[9px] font-bold bg-slate-700 text-white px-1 rounded">B</span>}
                </div>
                <button
                  onClick={() => onRemove(design.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 hover:border-red-300 transition-colors flex items-center justify-center text-xs shadow-sm opacity-0 group-hover:opacity-100"
                >✕</button>
              </div>
            );
          })}
          {library.length < MAX_DESIGNS && (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:text-indigo-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              <span className="text-[10px] font-semibold">Add</span>
            </button>
          )}
        </div>
      )}

      <input ref={inputRef} type="file" className="hidden" accept=".png,.svg" onChange={handleChange} />

      {/* Per-side status */}
      <div className="flex gap-2 text-xs">
        {['front', 'back'].map(s => (
          <div key={s} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
            side === s ? 'border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold' : 'border-transparent text-slate-400'
          }`}>
            <span className="capitalize">{s}:</span>
            <span className={sideDesigns[s]?.localDesignUrl ? 'text-emerald-600 font-semibold' : ''}>
              {sideDesigns[s]?.localDesignUrl ? '✓ set' : 'none'}
            </span>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Color Swatches ────────────────────────────────────────────
function ColorSwatches({ colors, selected, onChange, outOfStockColors = [] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-semibold text-slate-700">Color</span>
        <span className="text-sm text-slate-500">{selected}</span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {colors.map(({ name, hex }) => {
          const isOOS = outOfStockColors.includes(name);
          return (
            <button
              key={name}
              title={isOOS ? `${name} — Out of stock` : name}
              onClick={() => !isOOS && onChange(name)}
              disabled={isOOS}
              className={`relative w-8 h-8 rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                isOOS
                  ? 'border-slate-200 opacity-40 cursor-not-allowed'
                  : selected === name
                  ? 'border-indigo-500 scale-110 shadow-md'
                  : 'border-slate-300 hover:border-slate-500 hover:scale-105'
              }`}
              style={{ backgroundColor: hex }}
            >
              {selected === name && !isOOS && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: parseInt(hex.slice(1), 16) > 0xaaaaaa ? '#333' : '#fff' }} />
                </span>
              )}
              {isOOS && (
                <span className="absolute inset-0 flex items-center justify-center text-slate-500 text-[10px] font-bold">✕</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Backside Selector ─────────────────────────────────────────
function BacksideSelector({ value, onChange }) {
  return (
    <div>
      <span className="text-sm font-semibold text-slate-700 block mb-2">Backside</span>
      <div className="flex gap-2">
        {[
          { id: 'blank', label: 'Blank back' },
          { id: 'color', label: 'Print on back' },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
              value === opt.id
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Decoration Technology Selector ───────────────────────────
const DECORATION_DESCRIPTIONS = {
  dtg:        'Photorealistic full-color prints. Best for detailed artwork.',
  embroidery: 'Premium stitched look. Ideal for logos & text.',
  screen:     'Vibrant, durable. Great for simple designs & bulk orders.',
};

function DecorationSelector({ value, onChange }) {
  const options = [
    { id: 'dtg',        label: 'DTG' },
    { id: 'embroidery', label: 'Embroidery' },
    { id: 'screen',     label: 'Screen' },
  ];
  return (
    <div>
      <span className="text-sm font-semibold text-slate-700 block mb-2">Print Method</span>
      <div className="flex gap-2">
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`flex-1 py-2 px-3 rounded-xl border-2 text-xs font-semibold transition-all ${
              value === opt.id
                ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                : 'border-slate-200 text-slate-600 hover:border-indigo-300 bg-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2">{DECORATION_DESCRIPTIONS[value]}</p>
    </div>
  );
}

// ── Size Selector ─────────────────────────────────────────────
function SizeSelector({ sizes, selected, onChange, unavailable = [] }) {
  const sorted = sortSizes(sizes);
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-semibold text-slate-700">Size</span>
        <button className="text-xs text-indigo-600 hover:underline">Size guide</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {sorted.map(size => {
          const isUnavailable = unavailable.includes(size);
          return (
            <button
              key={size}
              disabled={isUnavailable}
              onClick={() => !isUnavailable && onChange(size)}
              className={`min-w-[3rem] px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                isUnavailable
                  ? 'border-slate-100 text-slate-300 cursor-not-allowed line-through'
                  : selected === size
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-400'
              }`}
            >
              {size}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Delivery Info Block ───────────────────────────────────────
function DeliveryBlock() {
  return (
    <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      {[
        { icon: '🚚', label: 'Standard · 5–7 days', sub: 'Free over $50' },
        { icon: '⚡', label: 'Express · 2–3 days',  sub: '$9.99' },
        { icon: '🏪', label: 'Pickup · Ready in 48h', sub: 'Select locations' },
      ].map(opt => (
        <div key={opt.label} className="flex items-center gap-3 px-4 py-2.5 bg-white">
          <span className="text-base">{opt.icon}</span>
          <span className="text-sm text-slate-700 font-medium flex-1">{opt.label}</span>
          <span className="text-xs text-slate-400">{opt.sub}</span>
        </div>
      ))}
    </div>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────
function Breadcrumb({ productName }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-400">
      <Link to="/" className="hover:text-indigo-600 transition-colors">Home</Link>
      <span>/</span>
      <Link to="/products" className="hover:text-indigo-600 transition-colors">Products</Link>
      <span>/</span>
      <span className="text-slate-700 font-medium truncate max-w-[220px]">{productName}</span>
    </nav>
  );
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium animate-slide-up ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      <span>{message}</span>
    </div>
  );
}

// ── Mini Cart Drawer ──────────────────────────────────────────
const DECORATION_LABELS = { dtg: 'DTG', embroidery: 'Embroidery', screen: 'Screen' };

function MiniCartItem({ item, onRemove, onQtyChange }) {
  const { variant, product, thumbnailUrl, config, quantity } = item;
  const [imgErr, setImgErr] = useState(false);
  const lineTotal = (variant?.price_cents ?? 0) * quantity;

  return (
    <div className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
      {/* Thumbnail */}
      <div className="w-14 h-16 flex-shrink-0 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
        {thumbnailUrl && !imgErr ? (
          <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{product?.name || 'Custom T-Shirt'}</p>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {config?.color && (
            <span className="text-xs text-slate-500">{config.color}</span>
          )}
          {config?.size && (
            <span className="text-xs text-slate-500">· {config.size}</span>
          )}
          {config?.decoration && (
            <span className="text-xs text-indigo-500">· {DECORATION_LABELS[config.decoration] || config.decoration}</span>
          )}
        </div>

        {/* Qty + price */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => quantity > 1 && onQtyChange(item.id, quantity - 1)}
              disabled={quantity <= 1}
              className="px-2 py-0.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30 text-sm"
            >−</button>
            <span className="px-2 text-xs font-semibold text-slate-700 border-x border-slate-200">{quantity}</span>
            <button
              onClick={() => onQtyChange(item.id, quantity + 1)}
              className="px-2 py-0.5 text-slate-500 hover:bg-slate-50 text-sm"
            >+</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{formatPrice(lineTotal)}</span>
            <button
              onClick={() => onRemove(item.id)}
              className="p-1 text-slate-300 hover:text-red-400 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniCart({ open, onClose, items, loading, onRemove, onQtyChange }) {
  const subtotal = items.reduce((acc, it) => acc + (it.variant?.price_cents ?? 0) * it.quantity, 0);
  const itemCount = items.reduce((acc, it) => acc + it.quantity, 0);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-base">
            Your cart
            {itemCount > 0 && <span className="ml-1.5 text-sm font-normal text-slate-400">({itemCount})</span>}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {loading ? (
            <div className="flex flex-col gap-3 py-4">
              {[1, 2].map(i => (
                <div key={i} className="flex gap-3 py-3 border-b border-slate-100 animate-pulse">
                  <div className="w-14 h-16 rounded-lg bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 flex flex-col gap-2 py-1">
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
              <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
              </svg>
              <p className="text-sm text-slate-500">Your cart is empty</p>
            </div>
          ) : (
            items.map(item => (
              <MiniCartItem key={item.id} item={item} onRemove={onRemove} onQtyChange={onQtyChange} />
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4 flex flex-col gap-3">
            <div className="flex justify-between text-sm font-semibold text-slate-800">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <Link
              to="/cart"
              onClick={onClose}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm text-center transition-colors active:scale-[0.98]"
            >
              Go to cart →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

// ── Inline Cart Preview (right column) ───────────────────────
function CartPreviewPanel({ items, loading, onRemove, onQtyChange }) {
  const subtotal = items.reduce((acc, it) => acc + (it.variant?.price_cents ?? 0) * it.quantity, 0);
  const itemCount = items.reduce((acc, it) => acc + it.quantity, 0);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3 animate-pulse">
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        {[1, 2].map(i => (
          <div key={i} className="flex gap-3">
            <div className="w-12 h-14 rounded-lg bg-slate-200 flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-2.5 bg-slate-200 rounded w-3/4" />
              <div className="h-2 bg-slate-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800">
          Your cart
          <span className="ml-1.5 text-indigo-600">({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
        </p>
        <span className="text-sm font-semibold text-slate-700">{formatPrice(subtotal)}</span>
      </div>

      {/* Item list */}
      <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
        {items.map(item => (
          <MiniCartItem key={item.id} item={item} onRemove={onRemove} onQtyChange={onQtyChange} />
        ))}
      </div>

      {/* Go to cart */}
      <Link
        to="/cart"
        className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-sm transition-colors active:scale-[0.98]"
      >
        Go to cart
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
        </svg>
      </Link>
    </div>
  );
}

// ── Interactive star picker (for review form) ─────────────────
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none"
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <svg
            className={`w-8 h-8 transition-colors ${
              star <= (hovered || value) ? 'text-amber-400' : 'text-slate-200'
            }`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
          </svg>
        </button>
      ))}
    </div>
  );
}

// ── Reviews Section ───────────────────────────────────────────
function ReviewsSection({ slug, product, session }) {
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitDone, setSubmitDone] = useState(false);

  // Live aggregate (updates after submission without page reload)
  const [liveRating, setLiveRating] = useState(null);
  const [liveCount, setLiveCount] = useState(null);

  // Form fields
  const [rating, setRating] = useState(0);
  const [reviewerName, setReviewerName] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    setLoadingReviews(true);
    setSubmitDone(false);
    fetchReviews(slug)
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoadingReviews(false));
  }, [slug]);

  const displayRating = liveRating ?? product?.base_rating ?? 0;
  const displayCount  = liveCount  ?? product?.rating_count ?? 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (rating === 0) { setSubmitError('Please select a rating.'); return; }
    setSubmitError('');
    setSubmitting(true);
    try {
      const result = await submitReview(slug, {
        rating,
        comment,
        reviewerName,
        anonymousId: localStorage.getItem('pdp_anon_id'),
        accessToken: session?.access_token || null,
      });
      // Prepend new review to list
      setReviews(prev => [result.review, ...prev]);
      setLiveRating(result.newRating);
      setLiveCount(result.newCount);
      setSubmitDone(true);
      setShowForm(false);
      setRating(0);
      setReviewerName('');
      setComment('');
    } catch (err) {
      setSubmitError(err.message || 'Could not submit review.');
    } finally {
      setSubmitting(false);
    }
  }

  const ratingBars = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="pt-6 pb-10 border-t border-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Customer Reviews</h2>
          {displayCount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StarRating rating={displayRating} count={displayCount} />
            </div>
          )}
        </div>
        {!showForm && !submitDone && (
          <button
            onClick={() => setShowForm(true)}
            className="self-start sm:self-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Write a Review
          </button>
        )}
        {submitDone && (
          <span className="text-sm text-emerald-600 font-medium">Thanks for your review!</span>
        )}
      </div>

      {/* Rating distribution */}
      {reviews.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-8 max-w-xs">
          {ratingBars.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-4 text-right font-medium">{star}</span>
              <svg className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
              </svg>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%' }}
                />
              </div>
              <span className="w-4">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Review form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 p-5 mb-8 space-y-4 shadow-sm"
        >
          <h3 className="font-semibold text-slate-800">Your Review</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Rating</label>
            <StarPicker value={rating} onChange={setRating} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Your name"
              maxLength={80}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Comment <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you think of this product?"
              rows={3}
              maxLength={1000}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>

          {submitError && <p className="text-sm text-red-500">{submitError}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setSubmitError(''); }}
              className="px-5 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:border-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Reviews list */}
      {loadingReviews ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-3 bg-slate-100 rounded w-1/4" />
              <div className="h-2.5 bg-slate-100 rounded w-3/4" />
              <div className="h-2.5 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-slate-400">No reviews yet. Be the first to write one!</p>
      ) : (
        <div className="space-y-5">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="flex text-amber-400">
                  {Array.from({ length: 5 }, (_, i) => (
                    <svg key={i} className="w-3.5 h-3.5" fill={i < review.rating ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-semibold text-slate-800">
                  {review.reviewer_name || 'Anonymous'}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
              {review.comment && (
                <p className="text-sm text-slate-600 leading-relaxed">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main PDP ─────────────────────────────────────────────────
export default function ProductDetailPage() {
  const { slug } = useParams();
  const { user, session } = useAuth();

  // Product data
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [product, setProduct]         = useState(null);
  const [variants, setVariants]       = useState([]);
  const [images, setImages]           = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);

  // Selections
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize]   = useState(null);
  const [backside, setBackside]           = useState('blank');
  const [decoration, setDecoration]       = useState('dtg');

  // Preview / design
  const [side, setSide] = useState('front');

  // Library of uploaded designs (max 4) – { id, file, localUrl }
  const [designLibrary, setDesignLibrary] = useState([]);

  // Per-side design: front and back are independent
  const [sideDesigns, setSideDesigns] = useState({
    front: { pendingFile: null, localDesignUrl: null, placement: null },
    back:  { pendingFile: null, localDesignUrl: null, placement: null },
  });

  // Cart / UI
  const [addingToCart, setAddingToCart]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toast, setToast]                   = useState(null);

  // Mini cart
  const [miniCartOpen, setMiniCartOpen]       = useState(false);
  const [miniCartItems, setMiniCartItems]     = useState([]);
  const [miniCartLoading, setMiniCartLoading] = useState(false);

  // Load mini-cart data (used by both drawer + inline panel)
  const loadCart = useCallback(async () => {
    setMiniCartLoading(true);
    try {
      const { items } = await fetchCart(getAnonymousId());
      setMiniCartItems(items || []);
    } catch {
      setMiniCartItems([]);
    } finally {
      setMiniCartLoading(false);
    }
  }, []);

  const openMiniCart = useCallback(async () => {
    setMiniCartOpen(true);
    await loadCart();
  }, [loadCart]);

  // Load cart on mount so the inline preview is populated immediately
  useEffect(() => {
    if (getAnonymousId()) loadCart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMiniCartRemove = useCallback(async (itemId) => {
    setMiniCartItems(prev => prev.filter(it => it.id !== itemId));
    await removeCartItem(itemId).catch(() => {});
  }, []);

  const handleMiniCartQtyChange = useCallback(async (itemId, qty) => {
    setMiniCartItems(prev => prev.map(it => it.id === itemId ? { ...it, quantity: qty } : it));
    await updateCartItem(itemId, qty).catch(() => {});
  }, []);

  // Load product
  useEffect(() => {
    setLoading(true);
    setError(null);
    setRelatedProducts([]);
    fetchProduct(slug)
      .then(({ product, variants, images }) => {
        setProduct(product);
        setVariants(variants);
        setImages(images);
        const firstColor = variants[0]?.color_name;
        setSelectedColor(firstColor);
        const sorted = sortSizes(variants.filter(v => v.color_name === firstColor).map(v => v.size));
        setSelectedSize(sorted[0] || null);
        setLoading(false);
        fetchRelatedProducts(slug).then(setRelatedProducts).catch(() => {});
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [slug]);

  // Revoke all blob URLs when component unmounts
  useEffect(() => {
    return () => {
      designLibrary.forEach(d => URL.revokeObjectURL(d.localUrl));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived data
  const uniqueColors = variants.reduce((acc, v) => {
    if (!acc.find(c => c.name === v.color_name)) acc.push({ name: v.color_name, hex: v.color_hex });
    return acc;
  }, []);

  const sizesForColor = selectedColor
    ? sortSizes([...new Set(variants.filter(v => v.color_name === selectedColor).map(v => v.size))])
    : [];

  const selectedVariant = variants.find(v => v.color_name === selectedColor && v.size === selectedSize);

  const priceRange = (() => {
    if (!variants.length) return null;
    const prices = variants.map(v => v.price_cents);
    const min = Math.min(...prices), max = Math.max(...prices);
    return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
  })();

  // Images for the selected colour.
  // Prefer colour-specific images; fall back to "All colours" (color_name = null) images.
  const colorSpecificImages = images.filter(img => img.color_name === selectedColor);
  const colorImages = colorSpecificImages.length > 0
    ? colorSpecificImages
    : images.filter(img => !img.color_name);

  // Available sides derived from colorImages
  const availableSides = [...new Set(
    colorImages.map(img => img.angle).filter(a => a === 'front' || a === 'back')
  )];

  // Exact match on current side; null if not found
  const currentMockup = colorImages.find(img => img.angle === side) || null;

  // Tint hex: when there is no colour-specific mockup for the current side,
  // pass the selected colour's hex so DesignPreview applies a multiply overlay
  // to simulate that shirt colour from the fallback (white/neutral) mockup.
  const hasMockupForSide = colorSpecificImages.some(img => img.angle === side);
  const tintHex = hasMockupForSide
    ? null
    : (uniqueColors.find(c => c.name === selectedColor)?.hex ?? null);

  // OOS derived data
  // Sizes of selected color that are explicitly out of stock (stock === 0)
  const oosForColor = selectedColor
    ? variants
        .filter(v => v.color_name === selectedColor && v.stock === 0)
        .map(v => v.size)
    : [];

  // Colors where every variant is OOS
  const oosColors = uniqueColors
    .filter(c =>
      variants.filter(v => v.color_name === c.name).length > 0 &&
      variants.filter(v => v.color_name === c.name).every(v => v.stock === 0)
    )
    .map(c => c.name);

  const isOOS = selectedVariant?.stock === 0;

  // Handlers
  const handleColorChange = (color) => {
    setSelectedColor(color);
    const sizes = sortSizes([...new Set(variants.filter(v => v.color_name === color).map(v => v.size))]);
    // Prefer an in-stock size; fall back to first available
    const firstAvailable = sizes.find(s => {
      const v = variants.find(vv => vv.color_name === color && vv.size === s);
      return !v || v.stock !== 0;
    });
    setSelectedSize(firstAvailable || sizes[0] || null);
    setSide('front'); // reset side so we never stay stuck on 'back' for a colour that only has 'front'
  };

  // Add a new file to the library and apply it to the current side
  const handleAddFile = useCallback((file) => {
    if (designLibrary.length >= MAX_DESIGNS) return;
    const localUrl = URL.createObjectURL(file);
    const newDesign = { id: Date.now(), file, localUrl };
    setDesignLibrary(prev => [...prev, newDesign]);
    setSideDesigns(prev => ({
      ...prev,
      [side]: {
        pendingFile: file,
        localDesignUrl: localUrl,
        placement: prev[side].placement || makeDefaultPlacement(side),
      },
    }));
  }, [designLibrary.length, side]);

  // Apply an existing library design to the current side
  const handleApplyDesign = useCallback((design) => {
    setSideDesigns(prev => ({
      ...prev,
      [side]: {
        pendingFile: design.file,
        localDesignUrl: design.localUrl,
        placement: prev[side].placement || makeDefaultPlacement(side),
      },
    }));
  }, [side]);

  // Remove a design from the library and clear it from any side using it
  const handleRemoveDesign = useCallback((id) => {
    const design = designLibrary.find(d => d.id === id);
    if (!design) return;
    URL.revokeObjectURL(design.localUrl);
    setDesignLibrary(prev => prev.filter(d => d.id !== id));
    setSideDesigns(prev => {
      const next = { ...prev };
      for (const s of ['front', 'back']) {
        if (next[s].localDesignUrl === design.localUrl) {
          next[s] = { pendingFile: null, localDesignUrl: null, placement: null };
        }
      }
      return next;
    });
  }, [designLibrary]);

  // Update placement for the current side
  const handlePlacementChange = useCallback((p) => {
    setSideDesigns(prev => ({ ...prev, [side]: { ...prev[side], placement: p } }));
  }, [side]);

  // Add to cart: upload front + back designs independently, then persist
  const handleAddToCart = async () => {
    if (!selectedVariant) {
      setToast({ message: 'Please select a size', type: 'error' });
      return;
    }
    setAddingToCart(true);
    setUploadProgress(0);
    try {
      const anonId = getAnonymousId();

      // Upload front design if present
      let frontResult = null;
      if (sideDesigns.front.pendingFile) {
        frontResult = await uploadDesign({
          file: sideDesigns.front.pendingFile,
          anonymousId: anonId,
          onProgress: setUploadProgress,
        });
      }

      // Upload back design if present (and different from front)
      let backResult = null;
      if (sideDesigns.back.pendingFile &&
          sideDesigns.back.pendingFile !== sideDesigns.front.pendingFile) {
        backResult = await uploadDesign({
          file: sideDesigns.back.pendingFile,
          anonymousId: anonId,
        });
      } else if (sideDesigns.back.pendingFile &&
                 sideDesigns.back.pendingFile === sideDesigns.front.pendingFile) {
        // Same file on both sides – reuse the front upload result
        backResult = frontResult;
      }

      const config = {
        backside,
        decoration,
        color:  selectedColor,
        size:   selectedSize,
        front: frontResult ? {
          design_url:         frontResult.storagePath,
          design_preview_url: frontResult.previewUrl,
          placement:          sideDesigns.front.placement ?? null,
        } : null,
        back: backResult ? {
          design_url:         backResult.storagePath,
          design_preview_url: backResult.previewUrl,
          placement:          sideDesigns.back.placement ?? null,
        } : null,
        // Legacy field for cart preview thumbnail
        design_preview_url: frontResult?.previewUrl || backResult?.previewUrl || null,
      };

      await addToCart({ variantId: selectedVariant.id, quantity: 1, config, anonymousId: anonId });
      await loadCart();
      setMiniCartOpen(true);
      setToast({ message: 'Added to cart!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to add to cart', type: 'error' });
    } finally {
      setAddingToCart(false);
      setUploadProgress(0);
    }
  };

  // Loading / error states
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm">Loading product…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-5xl">😕</p>
          <p className="text-lg font-semibold text-slate-700">Product not found</p>
          <p className="text-sm text-slate-500">{error}</p>
          <Link to="/" className="inline-block mt-4 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  // Add-to-cart button label
  const hasPendingFile = sideDesigns.front.pendingFile || sideDesigns.back.pendingFile;
  const cartBtnLabel = (() => {
    if (isOOS) return 'Out of Stock';
    if (!addingToCart) return 'Add to Cart';
    if (hasPendingFile && uploadProgress < 100) return `Uploading… ${uploadProgress}%`;
    return (
      <span className="flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Adding…
      </span>
    );
  })();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top nav ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-slate-900 tracking-tight">
            Print<span className="text-indigo-600">Shop</span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to="/account" className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors hidden sm:block">
                My Account
              </Link>
            ) : (
              <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors hidden sm:block">
                Sign In
              </Link>
            )}
            <button
              onClick={openMiniCart}
              className="p-2 text-slate-500 hover:text-indigo-600 transition-colors"
              title="Cart"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <Breadcrumb productName={product.name} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

          {/* ── Left: Live preview ─────────────────────────── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
              <DesignPreview
                mockupUrl={currentMockup?.url}
                selectedColorHex={tintHex}
                side={side}
                onSideChange={setSide}
                availableSides={availableSides}
                localDesignUrl={sideDesigns[side].localDesignUrl}
                placement={sideDesigns[side].placement}
                onPlacementChange={handlePlacementChange}
              />
            </div>
          </div>

          {/* ── Right: Product info + options ──────────────── */}
          <div className="space-y-5">

            {/* Name + rating + price */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{product.name}</h1>
              <StarRating rating={product.base_rating} count={product.rating_count} />
              <div className="flex items-baseline gap-3 pt-1">
                <span className="text-3xl font-bold text-slate-900">
                  {selectedVariant ? formatPrice(selectedVariant.price_cents) : priceRange || '—'}
                </span>
                {variants.length > 0 && !selectedVariant && (
                  <span className="text-sm text-slate-400">Select size for exact price</span>
                )}
              </div>
            </div>

            <p className="text-slate-500 text-sm leading-relaxed">{product.description}</p>

            {variants.length === 0 ? (
              /* ── No variants yet ────────────────────────────── */
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center space-y-2">
                <p className="text-sm font-semibold text-amber-700">No options available yet</p>
                <p className="text-xs text-amber-600">
                  This product isn't ready for purchase. Please check back soon.
                </p>
              </div>
            ) : (
              <>
                {/* Colour + Size */}
                <div className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
                  <ColorSwatches colors={uniqueColors} selected={selectedColor} onChange={handleColorChange} outOfStockColors={oosColors} />
                  <SizeSelector sizes={sizesForColor} selected={selectedSize} onChange={setSelectedSize} unavailable={oosForColor} />
                </div>

                {/* Design upload */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <DesignPicker
                    library={designLibrary}
                    side={side}
                    sideDesigns={sideDesigns}
                    onAddFile={handleAddFile}
                    onApply={handleApplyDesign}
                    onRemove={handleRemoveDesign}
                  />
                </div>

                {/* Print options */}
                <div className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
                  <BacksideSelector value={backside} onChange={setBackside} />
                  <DecorationSelector value={decoration} onChange={setDecoration} />
                </div>

                {/* Delivery */}
                <DeliveryBlock />

                {/* CTA */}
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart || !selectedVariant || isOOS}
                  className={`w-full py-4 px-6 font-semibold rounded-2xl transition-all active:scale-[0.98] text-base ${
                    isOOS
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-indigo-100'
                  }`}
                >
                  {cartBtnLabel}
                </button>
              </>
            )}

            {selectedVariant && (
              <p className="text-xs text-center">
                <span className="text-slate-400">SKU: {selectedVariant.sku}</span>
                {selectedVariant.stock !== null && (
                  <>
                    {' · '}
                    {selectedVariant.stock === 0 ? (
                      <span className="text-red-500 font-medium">Out of stock</span>
                    ) : selectedVariant.stock <= 5 ? (
                      <span className="text-amber-600 font-medium">Only {selectedVariant.stock} left</span>
                    ) : (
                      <span className="text-green-600">{selectedVariant.stock} in stock</span>
                    )}
                  </>
                )}
              </p>
            )}

            {/* ── Inline cart preview ─────────────────────── */}
            <CartPreviewPanel
              items={miniCartItems}
              loading={miniCartLoading}
              onRemove={handleMiniCartRemove}
              onQtyChange={handleMiniCartQtyChange}
            />

          </div>
        </div>

        {/* ── You might also like ────────────────────────── */}
        {relatedProducts.length > 0 && (
          <div className="pt-4 pb-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">You might also like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedProducts.map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                >
                  <div className="aspect-[4/5] bg-slate-100 overflow-hidden relative">
                    {p.thumbnailUrl ? (
                      <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1">
                    <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">{p.name}</p>
                    {p.minPrice && (
                      <p className="text-sm font-semibold text-indigo-600">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.minPrice / 100)}
                      </p>
                    )}
                    {p.colors?.length > 0 && (
                      <div className="flex gap-1 mt-0.5">
                        {p.colors.slice(0, 5).map((c) => (
                          <span key={c.name} title={c.name} className="w-3 h-3 rounded-full border border-slate-200 flex-shrink-0" style={{ background: c.hex }} />
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Reviews ──────────────────────────────────────── */}
        {product && (
          <ReviewsSection slug={slug} product={product} session={session} />
        )}

      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <MiniCart
        open={miniCartOpen}
        onClose={() => setMiniCartOpen(false)}
        items={miniCartItems}
        loading={miniCartLoading}
        onRemove={handleMiniCartRemove}
        onQtyChange={handleMiniCartQtyChange}
      />

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(1rem); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease; }
      `}</style>
    </div>
  );
}
