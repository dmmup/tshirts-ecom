// src/pages/ProductDetailPage.jsx
// ─────────────────────────────────────────────────────────────
// Product Detail Page (PDP)
// Route: /products/:slug
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchProduct, uploadDesign, addToCart } from '../api/products';

// ── Helpers ──────────────────────────────────────────────────

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

function sortSizes(sizes) {
  return [...sizes].sort(
    (a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b)
  );
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

// ── Product Gallery ───────────────────────────────────────────
function ProductGallery({ images, selectedColor }) {
  const colorImages = images.filter(img => !selectedColor || img.color_name === selectedColor);
  const displayImages = colorImages.length > 0 ? colorImages : images;
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset to front when color changes
  useEffect(() => {
    const frontIdx = displayImages.findIndex(img => img.angle === 'front');
    setActiveIndex(frontIdx >= 0 ? frontIdx : 0);
  }, [selectedColor]);

  const active = displayImages[activeIndex];

  return (
    <div className="flex flex-col gap-4">
      {/* Main image */}
      <div className="relative aspect-[4/5] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
        {active ? (
          <img
            key={active.url}
            src={active.url}
            alt={`${selectedColor || ''} ${active.angle}`}
            className="w-full h-full object-contain transition-opacity duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
        )}
        {/* Angle badge */}
        {active && (
          <span className="absolute top-3 left-3 bg-white/80 backdrop-blur-sm text-xs font-semibold text-slate-600 px-2.5 py-1 rounded-full capitalize border border-slate-200/50">
            {active.angle}
          </span>
        )}
      </div>

      {/* Thumbnails */}
      {displayImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {displayImages.map((img, idx) => (
            <button
              key={img.id || idx}
              onClick={() => setActiveIndex(idx)}
              className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                idx === activeIndex
                  ? 'border-indigo-500 shadow-md shadow-indigo-100'
                  : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              <img src={img.url} alt={img.angle} className="w-full h-full object-contain" />
            </button>
          ))}
        </div>
      )}
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
            {/* White dot indicator for selected */}
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
    {
      id: 'dtg',
      label: 'Direct-to-Garment',
      description: 'Photorealistic prints. Best for complex artwork.',
      icon: '🎨',
    },
    {
      id: 'embroidery',
      label: 'Embroidery',
      description: 'Premium stitched look. Ideal for logos.',
      icon: '🧵',
    },
    {
      id: 'screen',
      label: 'Screen Print',
      description: 'Vibrant, durable. Great for bulk orders.',
      icon: '🖨️',
    },
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
              value === opt.id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <span className="text-xl mt-0.5">{opt.icon}</span>
            <div>
              <div className={`text-sm font-semibold ${value === opt.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                {opt.label}
              </div>
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

// ── Design Uploader ───────────────────────────────────────────
const MAX_FILE_SIZE_MB = 20;

function DesignUploader({ onUpload }) {
  const [state, setState] = useState('idle'); // idle | uploading | success | error
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const allowed = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Please upload a PNG, SVG, JPEG, or WebP file.');
      setState('error');
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File size must be under ${MAX_FILE_SIZE_MB}MB.`);
      setState('error');
      return;
    }

    setFilename(file.name);
    setState('uploading');
    setProgress(0);
    setError('');

    try {
      const anonymousId = getAnonymousId();
      const result = await uploadDesign({
        file,
        anonymousId,
        onProgress: setProgress,
      });
      setState('success');
      onUpload(result);
    } catch (err) {
      setError(err.message || 'Upload failed.');
      setState('error');
    }
  }, [onUpload]);

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleChange = (e) => {
    handleFile(e.target.files[0]);
  };

  return (
    <div>
      <span className="text-sm font-semibold text-slate-700 block mb-2.5">Your Design</span>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => state !== 'uploading' && fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
          state === 'success'
            ? 'border-emerald-400 bg-emerald-50'
            : state === 'error'
            ? 'border-red-400 bg-red-50'
            : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/40'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".png,.svg,.jpg,.jpeg,.webp"
          onChange={handleChange}
        />

        {state === 'idle' && (
          <>
            <div className="text-3xl mb-2">📎</div>
            <p className="text-sm font-medium text-slate-600">Click or drag to upload your design</p>
            <p className="text-xs text-slate-400 mt-1">PNG, SVG, JPEG, WebP · Max {MAX_FILE_SIZE_MB}MB</p>
          </>
        )}

        {state === 'uploading' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-600">Uploading {filename}…</p>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">{progress}%</p>
          </div>
        )}

        {state === 'success' && (
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-emerald-700">{filename}</p>
              <p className="text-xs text-emerald-600">Upload successful!</p>
            </div>
            <button
              className="ml-auto text-xs text-slate-400 hover:text-slate-600 underline"
              onClick={(e) => { e.stopPropagation(); setState('idle'); setFilename(''); onUpload(null); }}
            >
              Remove
            </button>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-red-600">Upload failed</p>
            <p className="text-xs text-red-500">{error}</p>
            <button className="text-xs text-indigo-600 hover:underline" onClick={(e) => { e.stopPropagation(); setState('idle'); }}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Delivery Info Block ───────────────────────────────────────
function DeliveryBlock() {
  const options = [
    { icon: '🚚', label: 'Standard Delivery', detail: '5–7 business days · Free over $50' },
    { icon: '⚡', label: 'Express Delivery', detail: '2–3 business days · $9.99' },
    { icon: '🏪', label: 'Pickup Available', detail: 'Ready in 48h at select locations' },
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
          {c.to ? (
            <Link to={c.to} className="hover:text-indigo-600 transition-colors">{c.label}</Link>
          ) : (
            <span className="text-slate-800 font-medium truncate max-w-[180px]">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ── Toast Notification ────────────────────────────────────────
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

// ── Main PDP Component ────────────────────────────────────────
export default function ProductDetailPage() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [images, setImages] = useState([]);

  // Selections
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [backside, setBackside] = useState('blank');
  const [decoration, setDecoration] = useState('dtg');
  const [uploadResult, setUploadResult] = useState(null);

  const [addingToCart, setAddingToCart] = useState(false);
  const [toast, setToast] = useState(null);

  // Load product data
  useEffect(() => {
    setLoading(true);
    fetchProduct(slug)
      .then(({ product, variants, images }) => {
        setProduct(product);
        setVariants(variants);
        setImages(images);

        // Default selections
        const firstColor = variants[0]?.color_name;
        setSelectedColor(firstColor);
        const sizesForColor = variants
          .filter(v => v.color_name === firstColor)
          .map(v => v.size);
        const sorted = sortSizes(sizesForColor);
        setSelectedSize(sorted[0] || null);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  // Derived data
  const uniqueColors = variants.reduce((acc, v) => {
    if (!acc.find(c => c.name === v.color_name)) {
      acc.push({ name: v.color_name, hex: v.color_hex });
    }
    return acc;
  }, []);

  const sizesForColor = selectedColor
    ? sortSizes([...new Set(variants.filter(v => v.color_name === selectedColor).map(v => v.size))])
    : [];

  const selectedVariant = variants.find(
    v => v.color_name === selectedColor && v.size === selectedSize
  );

  const priceRange = (() => {
    if (!variants.length) return null;
    const prices = variants.map(v => v.price_cents);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return formatPrice(min);
    return `${formatPrice(min)} – ${formatPrice(max)}`;
  })();

  // When color changes, reset size to first available
  const handleColorChange = (color) => {
    setSelectedColor(color);
    const sizes = sortSizes([...new Set(variants.filter(v => v.color_name === color).map(v => v.size))]);
    setSelectedSize(sizes[0] || null);
  };

  const handleAddToCart = async () => {
    if (!selectedVariant) {
      setToast({ message: 'Please select a size', type: 'error' });
      return;
    }
    setAddingToCart(true);
    try {
      const config = {
        backside,
        decoration,
        design_url: uploadResult?.storagePath || null,
        design_preview_url: uploadResult?.previewUrl || null,
        color: selectedColor,
        size: selectedSize,
      };
      const result = await addToCart({
        variantId: selectedVariant.id,
        quantity: 1,
        config,
        anonymousId: getAnonymousId(),
      });
      setToast({ message: 'Added to cart!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to add to cart', type: 'error' });
    } finally {
      setAddingToCart(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────
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

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Breadcrumb */}
        <Breadcrumb productName={product.name} />

        {/* Main 2-col layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

          {/* ── Left: Gallery ─────────────────────────── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ProductGallery images={images} selectedColor={selectedColor} />
          </div>

          {/* ── Right: Product Info ────────────────────── */}
          <div className="space-y-6">

            {/* Title + Rating */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                {product.name}
              </h1>
              <StarRating rating={product.base_rating} count={product.rating_count} />
            </div>

            {/* Description */}
            <p className="text-slate-600 text-sm leading-relaxed">
              {product.description}
            </p>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-slate-900">
                {selectedVariant ? formatPrice(selectedVariant.price_cents) : priceRange}
              </span>
              {!selectedVariant && (
                <span className="text-sm text-slate-400">Select size for exact price</span>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* Delivery */}
            <DeliveryBlock />

            <hr className="border-slate-100" />

            {/* Color Swatches */}
            <ColorSwatches
              colors={uniqueColors}
              selected={selectedColor}
              onChange={handleColorChange}
            />

            {/* Backside */}
            <BacksideSelector value={backside} onChange={setBackside} />

            {/* Decoration */}
            <DecorationSelector value={decoration} onChange={setDecoration} />

            {/* Size */}
            <SizeSelector
              sizes={sizesForColor}
              selected={selectedSize}
              onChange={setSelectedSize}
            />

            <hr className="border-slate-100" />

            {/* Design Upload */}
            <DesignUploader onUpload={setUploadResult} />

            {/* CTA Buttons */}
            <div className="space-y-3 pt-1">
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || !selectedVariant}
                className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl transition-all shadow-md shadow-indigo-100 active:scale-[0.98] text-base"
              >
                {addingToCart ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Adding…
                  </span>
                ) : (
                  'Add to Cart'
                )}
              </button>

              <button className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-2xl transition-all active:scale-[0.98] text-sm">
                Generate Templates
              </button>
            </div>

            {/* SKU / Stock info */}
            {selectedVariant && (
              <p className="text-xs text-slate-400 text-center">
                SKU: {selectedVariant.sku} · {selectedVariant.stock > 0 ? `${selectedVariant.stock} in stock` : 'Out of stock'}
              </p>
            )}

          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}

      {/* Toast animation */}
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
