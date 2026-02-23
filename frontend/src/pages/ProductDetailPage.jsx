// src/pages/ProductDetailPage.jsx
// ─────────────────────────────────────────────────────────────
// Product Detail Page (PDP)
// Route: /products/:slug
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchProduct, uploadDesign, addToCart, fetchCart, removeCartItem, updateCartItem } from '../api/products';
import DesignPreview, { makeDefaultPlacement } from '../components/DesignPreview';

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
// Compact file selector – upload is deferred to Add to Cart
function DesignPicker({ file, localDesignUrl, onFile }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const f = e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError('Only PNG or SVG files are accepted.');
      return;
    }
    if (f.size > MAX_DESIGN_MB * 1024 * 1024) {
      setError(`Max file size is ${MAX_DESIGN_MB}MB.`);
      return;
    }
    setError('');
    onFile(f);
  };

  return (
    <div>
      <span className="text-sm font-semibold text-slate-700 block mb-2.5">Your Design</span>
      <input ref={inputRef} type="file" className="hidden" accept=".png,.svg" onChange={handleChange} />

      {file && localDesignUrl ? (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
          <div className="w-10 h-10 rounded-lg bg-white border border-emerald-200 overflow-hidden flex-shrink-0">
            <img src={localDesignUrl} alt="design thumbnail" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-700 truncate">{file.name}</p>
            <button onClick={() => inputRef.current?.click()} className="text-xs text-indigo-600 hover:underline">
              Change design
            </button>
          </div>
          <button
            onClick={() => onFile(null)}
            className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full py-3.5 px-4 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Upload design (PNG / SVG · max {MAX_DESIGN_MB}MB)
        </button>
      )}
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Color Swatches ────────────────────────────────────────────
function ColorSwatches({ colors, selected, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-semibold text-slate-700">Color</span>
        <span className="text-sm text-slate-500">{selected}</span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {colors.map(({ name, hex }) => (
          <button
            key={name}
            title={name}
            onClick={() => onChange(name)}
            className={`relative w-8 h-8 rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
              selected === name
                ? 'border-indigo-500 scale-110 shadow-md'
                : 'border-slate-300 hover:border-slate-500 hover:scale-105'
            }`}
            style={{ backgroundColor: hex }}
          >
            {selected === name && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: parseInt(hex.slice(1), 16) > 0xaaaaaa ? '#333' : '#fff' }} />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Backside Selector ─────────────────────────────────────────
function BacksideSelector({ value, onChange }) {
  const options = [
    { id: 'blank', label: 'Blank', description: 'No print on back' },
    { id: 'color', label: 'Color', description: 'Print on back too' },
  ];
  return (
    <div>
      <span className="text-sm font-semibold text-slate-700 block mb-2.5">Backside</span>
      <div className="flex gap-3">
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`flex-1 py-2.5 px-4 rounded-xl border-2 text-sm font-medium transition-all text-center ${
              value === opt.id
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 text-slate-600 hover:border-slate-400'
            }`}
          >
            <div className="font-semibold">{opt.label}</div>
            <div className="text-xs font-normal opacity-70 mt-0.5">{opt.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Decoration Technology Selector ───────────────────────────
function DecorationSelector({ value, onChange }) {
  const options = [
    { id: 'dtg',        label: 'Direct-to-Garment', description: 'Photorealistic prints. Best for complex artwork.', icon: '🎨' },
    { id: 'embroidery', label: 'Embroidery',         description: 'Premium stitched look. Ideal for logos.',          icon: '🧵' },
    { id: 'screen',     label: 'Screen Print',       description: 'Vibrant, durable. Great for bulk orders.',         icon: '🖨️' },
  ];
  return (
    <div>
      <span className="text-sm font-semibold text-slate-700 block mb-2.5">Decoration Technology</span>
      <div className="flex flex-col gap-2">
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
              value === opt.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <span className="text-xl mt-0.5">{opt.icon}</span>
            <div>
              <div className={`text-sm font-semibold ${value === opt.id ? 'text-indigo-700' : 'text-slate-700'}`}>{opt.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{opt.description}</div>
            </div>
            {value === opt.id && (
              <span className="ml-auto mt-0.5 text-indigo-500">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>
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
  const options = [
    { icon: '🚚', label: 'Standard Delivery', detail: '5–7 business days · Free over $50' },
    { icon: '⚡', label: 'Express Delivery',   detail: '2–3 business days · $9.99' },
    { icon: '🏪', label: 'Pickup Available',   detail: 'Ready in 48h at select locations' },
  ];
  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
      {options.map(opt => (
        <div key={opt.label} className="flex items-start gap-3">
          <span className="text-lg mt-0.5">{opt.icon}</span>
          <div>
            <p className="text-sm font-semibold text-slate-700">{opt.label}</p>
            <p className="text-xs text-slate-500">{opt.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────
function Breadcrumb({ productName }) {
  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Clothing & Bags', to: '/categories/clothing-bags' },
    { label: 'Custom T-shirts', to: '/categories/custom-tshirts' },
    { label: productName },
  ];
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500 flex-wrap">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-slate-300">/</span>}
          {c.to
            ? <Link to={c.to} className="hover:text-indigo-600 transition-colors">{c.label}</Link>
            : <span className="text-slate-800 font-medium truncate max-w-[180px]">{c.label}</span>
          }
        </span>
      ))}
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

// ── Main PDP ─────────────────────────────────────────────────
export default function ProductDetailPage() {
  const { slug } = useParams();

  // Product data
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [product, setProduct]   = useState(null);
  const [variants, setVariants] = useState([]);
  const [images, setImages]     = useState([]);

  // Selections
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize]   = useState(null);
  const [backside, setBackside]           = useState('blank');
  const [decoration, setDecoration]       = useState('dtg');

  // Preview / design
  const [side, setSide]               = useState('front');
  const [pendingFile, setPendingFile] = useState(null);        // File – uploaded lazily on Add to Cart
  const [localDesignUrl, setLocalDesignUrl] = useState(null); // blob URL for instant preview
  const [placement, setPlacement]     = useState(null);        // { x, y, wPct, rotation, flipped }

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
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [slug]);

  // Revoke blob URL when it changes or on unmount
  useEffect(() => {
    return () => { if (localDesignUrl) URL.revokeObjectURL(localDesignUrl); };
  }, [localDesignUrl]);

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

  // Images for the selected colour (strict match)
  const colorImages = images.filter(img => img.color_name === selectedColor);

  // Available sides derived from colorImages
  const availableSides = [...new Set(
    colorImages.map(img => img.angle).filter(a => a === 'front' || a === 'back')
  )];

  // Exact match on current side; null if not found
  const currentMockup = colorImages.find(img => img.angle === side) || null;

  // Handlers
  const handleColorChange = (color) => {
    setSelectedColor(color);
    const sizes = sortSizes([...new Set(variants.filter(v => v.color_name === color).map(v => v.size))]);
    setSelectedSize(sizes[0] || null);
    setSide('front'); // reset side so we never stay stuck on 'back' for a colour that only has 'front'
  };

  // File selected → instant local preview; actual upload deferred
  const handleFileSelect = useCallback((file) => {
    if (localDesignUrl) URL.revokeObjectURL(localDesignUrl);
    if (!file) {
      setPendingFile(null);
      setLocalDesignUrl(null);
      setPlacement(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPendingFile(file);
    setLocalDesignUrl(url);
    setPlacement(makeDefaultPlacement(side));
  }, [localDesignUrl, side]);

  // Add to cart: upload design (if any) then persist config + placement
  const handleAddToCart = async () => {
    if (!selectedVariant) {
      setToast({ message: 'Please select a size', type: 'error' });
      return;
    }
    setAddingToCart(true);
    setUploadProgress(0);
    try {
      let designStoragePath = null;
      let designPreviewUrl  = null;

      if (pendingFile) {
        const result = await uploadDesign({
          file: pendingFile,
          anonymousId: getAnonymousId(),
          onProgress: setUploadProgress,
        });
        designStoragePath = result.storagePath;
        designPreviewUrl  = result.previewUrl;
      }

      const config = {
        backside,
        decoration,
        color: selectedColor,
        size: selectedSize,
        side,
        design_url:         designStoragePath,
        design_preview_url: designPreviewUrl,
        placement:          placement ?? null,
      };

      await addToCart({ variantId: selectedVariant.id, quantity: 1, config, anonymousId: getAnonymousId() });
      await loadCart();
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
  const cartBtnLabel = (() => {
    if (!addingToCart) return 'Add to Cart';
    if (pendingFile && uploadProgress < 100) return `Uploading… ${uploadProgress}%`;
    return (
      <span className="flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Adding…
      </span>
    );
  })();

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top nav ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-slate-900 tracking-tight">
            Print<span className="text-indigo-600">Shop</span>
          </Link>
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
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <Breadcrumb productName={product.name} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

          {/* ── Left: Live preview ─────────────────────────── */}
          <div className="lg:sticky lg:top-6 lg:self-start space-y-2">
            <DesignPreview
              mockupUrl={currentMockup?.url}
              side={side}
              onSideChange={setSide}
              availableSides={availableSides}
              localDesignUrl={localDesignUrl}
              placement={placement}
              onPlacementChange={setPlacement}
            />

            {/* ── Dev debug panel ── */}
            {import.meta.env.DEV && (
              <div className="font-mono text-[11px] bg-slate-900 text-slate-300 rounded-lg px-3 py-2 space-y-0.5 border border-slate-700">
                <div><span className="text-slate-500">color·</span> {selectedColor ?? '—'}</div>
                <div><span className="text-slate-500">side·</span>  {side}</div>
                <div className="break-all"><span className="text-slate-500">url·</span> {currentMockup?.url ?? <span className="text-red-400">none</span>}</div>
              </div>
            )}
          </div>

          {/* ── Right: Product info + options ──────────────── */}
          <div className="space-y-6">

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{product.name}</h1>
              <StarRating rating={product.base_rating} count={product.rating_count} />
            </div>

            <p className="text-slate-600 text-sm leading-relaxed">{product.description}</p>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-slate-900">
                {selectedVariant ? formatPrice(selectedVariant.price_cents) : priceRange}
              </span>
              {!selectedVariant && <span className="text-sm text-slate-400">Select size for exact price</span>}
            </div>

            <hr className="border-slate-100" />
            <DeliveryBlock />
            <hr className="border-slate-100" />

            <ColorSwatches colors={uniqueColors} selected={selectedColor} onChange={handleColorChange} />
            <BacksideSelector value={backside} onChange={setBackside} />
            <DecorationSelector value={decoration} onChange={setDecoration} />
            <SizeSelector sizes={sizesForColor} selected={selectedSize} onChange={setSelectedSize} />

            <hr className="border-slate-100" />

            {/* Compact design picker – preview shown instantly in left column */}
            <DesignPicker
              file={pendingFile}
              localDesignUrl={localDesignUrl}
              onFile={handleFileSelect}
            />

            {/* CTA */}
            <div className="space-y-3 pt-1">
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || !selectedVariant}
                className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl transition-all shadow-md shadow-indigo-100 active:scale-[0.98] text-base"
              >
                {cartBtnLabel}
              </button>
              <button className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-2xl transition-all active:scale-[0.98] text-sm">
                Generate Templates
              </button>
            </div>

            {selectedVariant && (
              <p className="text-xs text-slate-400 text-center">
                SKU: {selectedVariant.sku} · {selectedVariant.stock > 0 ? `${selectedVariant.stock} in stock` : 'Out of stock'}
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
