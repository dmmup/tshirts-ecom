// src/components/CatalogView.jsx
// ─────────────────────────────────────────────────────────────
// Shared catalog layout: left filter sidebar + product grid.
// Used by ProductCatalogPage, CategoryPage, and HomePage.
// ─────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

function formatPrice(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ── Skeleton card ─────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
      <div className="aspect-[4/5] bg-slate-100" />
      <div className="p-4 space-y-2.5">
        <div className="h-4 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/3" />
        <div className="flex gap-1.5 pt-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-4 h-4 rounded-full bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Product card ──────────────────────────────────────────────
export function ProductCard({ product }) {
  const [imgError, setImgError] = useState(false);
  const swatches = (product.colors || []).slice(0, 5);
  const extraColors = (product.colors || []).length - 5;

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      {/* Image with hover overlay */}
      <div className="relative aspect-[4/5] bg-slate-100 overflow-hidden">
        {product.thumbnailUrl && !imgError ? (
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <svg className="w-14 h-14 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Hover overlay CTA */}
        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3.5">
          <span className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-900 font-semibold rounded-xl text-sm translate-y-3 group-hover:translate-y-0 transition-transform duration-300">
            Customize
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-2">
        <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">{product.name}</h3>

        <div className="flex items-center justify-between">
          {product.minPrice !== null && (
            <span className="text-sm font-semibold text-slate-800">From {formatPrice(product.minPrice)}</span>
          )}
          {product.base_rating > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-amber-400 text-xs">★</span>
              <span className="text-xs text-slate-500 font-medium">{product.base_rating}</span>
            </div>
          )}
        </div>

        {/* Color swatches */}
        {swatches.length > 0 && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {swatches.map(({ name, hex }) => (
              <span
                key={name}
                title={name}
                className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0"
                style={{ backgroundColor: hex }}
              />
            ))}
            {extraColors > 0 && (
              <span className="text-[11px] text-slate-400 font-medium ml-0.5">+{extraColors}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Collapsible sidebar section ───────────────────────────────
function SidebarSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-3.5 text-sm font-bold text-slate-800 hover:text-indigo-600 transition-colors"
      >
        {title}
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

// ── Filter sidebar ─────────────────────────────────────────────
function FilterSidebar({ filters, onChange, allSizes, allColors, priceMin, priceMax, activeCount }) {
  const { search, minPrice, maxPrice, sizes, colors } = filters;

  const toggle = (arr, val) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const clearAll = () =>
    onChange({ search: '', minPrice: '', maxPrice: '', sizes: [], colors: [], sort: 'featured' });

  return (
    <div className="flex flex-col">
      {/* Clear all */}
      {activeCount > 0 && (
        <div className="flex items-center justify-between mb-1 pb-3 border-b border-slate-100">
          <span className="text-xs font-semibold text-indigo-600">
            {activeCount} filter{activeCount !== 1 ? 's' : ''} active
          </span>
          <button
            onClick={clearAll}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Search */}
      <SidebarSection title="Search">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search products…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
          />
        </div>
      </SidebarSection>

      {/* Price */}
      <SidebarSection title="Price">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={minPrice}
            onChange={(e) => onChange({ ...filters, minPrice: e.target.value })}
            placeholder={priceMin > 0 ? `$${Math.floor(priceMin / 100)}` : '$0'}
            className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
          />
          <span className="text-slate-300 flex-shrink-0">—</span>
          <input
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => onChange({ ...filters, maxPrice: e.target.value })}
            placeholder={priceMax > 0 ? `$${Math.ceil(priceMax / 100)}` : 'Any'}
            className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
          />
        </div>
      </SidebarSection>

      {/* Sizes */}
      {allSizes.length > 0 && (
        <SidebarSection title="Size">
          <div className="flex flex-wrap gap-2">
            {allSizes.map((size) => {
              const active = sizes.includes(size);
              return (
                <button
                  key={size}
                  onClick={() => onChange({ ...filters, sizes: toggle(sizes, size) })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    active
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </SidebarSection>
      )}

      {/* Colors */}
      {allColors.length > 0 && (
        <SidebarSection title="Color">
          <div className="flex flex-wrap gap-2.5">
            {allColors.map(({ name, hex }) => {
              const active = colors.includes(name);
              return (
                <button
                  key={name}
                  title={name}
                  onClick={() => onChange({ ...filters, colors: toggle(colors, name) })}
                  className={`relative w-7 h-7 rounded-full border-2 transition-all ${
                    active
                      ? 'border-indigo-500 scale-110 shadow-md'
                      : 'border-slate-300 hover:border-slate-500 hover:scale-105'
                  }`}
                  style={{ backgroundColor: hex }}
                >
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: parseInt(hex.replace('#', ''), 16) > 0xaaaaaa ? '#333' : '#fff' }}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </SidebarSection>
      )}
    </div>
  );
}

// ── Filter chip ───────────────────────────────────────────────
function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
      {label}
      <button onClick={onRemove} className="text-indigo-400 hover:text-indigo-700 transition-colors leading-none">
        ×
      </button>
    </span>
  );
}

// ── CatalogView ───────────────────────────────────────────────
// Props:
//   products   – enriched product array (with sizes, colors, minPrice, …)
//   loading    – boolean
//   title      – page heading
//   subtitle   – optional sub-heading text
//   breadcrumb – optional JSX breadcrumb row
export default function CatalogView({ products, loading, title, subtitle, breadcrumb }) {
  const [filters, setFilters] = useState({
    search: '',
    minPrice: '',
    maxPrice: '',
    sizes: [],
    colors: [],
    sort: 'featured',
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Aggregate all available sizes + colors from the full product list
  const allSizes = useMemo(() => {
    const set = new Set();
    products.forEach((p) => (p.sizes || []).forEach((s) => set.add(s)));
    return SIZE_ORDER.filter((s) => set.has(s));
  }, [products]);

  const allColors = useMemo(() => {
    const map = {};
    products.forEach((p) =>
      (p.colors || []).forEach((c) => { if (!map[c.name]) map[c.name] = c.hex; })
    );
    return Object.entries(map).map(([name, hex]) => ({ name, hex }));
  }, [products]);

  const priceMin = useMemo(
    () => (products.length ? Math.min(...products.map((p) => p.minPrice || 0)) : 0),
    [products]
  );
  const priceMax = useMemo(
    () => (products.length ? Math.max(...products.map((p) => p.minPrice || 0)) : 0),
    [products]
  );

  // Apply all filters + sort
  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (p.minPrice !== null) {
        if (filters.minPrice !== '' && p.minPrice < Number(filters.minPrice) * 100) return false;
        if (filters.maxPrice !== '' && p.minPrice > Number(filters.maxPrice) * 100) return false;
      }
      if (filters.sizes.length > 0 && !(p.sizes || []).some((s) => filters.sizes.includes(s))) return false;
      if (filters.colors.length > 0 && !(p.colors || []).some((c) => filters.colors.includes(c.name))) return false;
      return true;
    });

    switch (filters.sort) {
      case 'price_asc':  result = [...result].sort((a, b) => (a.minPrice || 0) - (b.minPrice || 0)); break;
      case 'price_desc': result = [...result].sort((a, b) => (b.minPrice || 0) - (a.minPrice || 0)); break;
      case 'newest':     result = [...result].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
    }
    return result;
  }, [products, filters]);

  const activeCount = [
    filters.search ? 1 : 0,
    filters.minPrice || filters.maxPrice ? 1 : 0,
    filters.sizes.length,
    filters.colors.length,
  ].reduce((a, b) => a + b, 0);

  const clearAll = () =>
    setFilters({ search: '', minPrice: '', maxPrice: '', sizes: [], colors: [], sort: 'featured' });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      {breadcrumb && <div className="mb-5">{breadcrumb}</div>}

      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{title}</h1>
        {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
      </div>

      <div className="flex gap-8 items-start">

        {/* ── Left sidebar (desktop) ───────────────────────── */}
        <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-24">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Filters</p>
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            allSizes={allSizes}
            allColors={allColors}
            priceMin={priceMin}
            priceMax={priceMax}
            activeCount={activeCount}
          />
        </aside>

        {/* ── Right: toolbar + grid ────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">

            {/* Mobile filter toggle */}
            <button
              onClick={() => setMobileFiltersOpen((o) => !o)}
              className="lg:hidden inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filters
              {activeCount > 0 && (
                <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full leading-none">
                  {activeCount}
                </span>
              )}
            </button>

            {/* Results count */}
            <p className="text-sm text-slate-500">
              {loading ? 'Loading…' : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
            </p>

            {/* Active filter chips */}
            {!loading && activeCount > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {filters.search && (
                  <Chip label={`"${filters.search}"`} onRemove={() => setFilters((f) => ({ ...f, search: '' }))} />
                )}
                {(filters.minPrice || filters.maxPrice) && (
                  <Chip
                    label={`$${filters.minPrice || '0'} – $${filters.maxPrice || '∞'}`}
                    onRemove={() => setFilters((f) => ({ ...f, minPrice: '', maxPrice: '' }))}
                  />
                )}
                {filters.sizes.map((s) => (
                  <Chip key={s} label={s} onRemove={() => setFilters((f) => ({ ...f, sizes: f.sizes.filter((x) => x !== s) }))} />
                ))}
                {filters.colors.map((c) => (
                  <Chip key={c} label={c} onRemove={() => setFilters((f) => ({ ...f, colors: f.colors.filter((x) => x !== c) }))} />
                ))}
              </div>
            )}

            {/* Sort dropdown — pushed to far right */}
            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm text-slate-500 hidden sm:block whitespace-nowrap">Sort by</label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
              >
                <option value="featured">Featured</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="newest">Newest first</option>
              </select>
            </div>
          </div>

          {/* Mobile filters panel */}
          {mobileFiltersOpen && (
            <div className="lg:hidden mb-6 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <FilterSidebar
                filters={filters}
                onChange={setFilters}
                allSizes={allSizes}
                allColors={allColors}
                priceMin={priceMin}
                priceMax={priceMax}
                activeCount={activeCount}
              />
            </div>
          )}

          {/* Product grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-14 h-14 mx-auto mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="font-semibold text-slate-500">No products match your filters</p>
              {activeCount > 0 && (
                <button onClick={clearAll} className="mt-3 text-sm text-indigo-600 hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
