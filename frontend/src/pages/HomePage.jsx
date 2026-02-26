// src/pages/HomePage.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { fetchCategories, fetchProducts } from '../api/products';
import CatalogView from '../components/CatalogView';
import LanguageSwitcher from '../components/LanguageSwitcher';

// ── Product Picker Modal ──────────────────────────────────────
function ProductPickerModal({ products, loading, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function pick(slug) {
    navigate(`/products/${slug}`);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel — bottom sheet on mobile, centered card on desktop */}
      <div
        className="relative z-10 bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{t('home.modal.heading')}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{t('home.modal.subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
            aria-label={t('common.close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable product grid */}
        <div className="overflow-y-auto p-6">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
                  <div className="aspect-square bg-slate-100" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-center text-slate-500 py-12 text-sm">{t('home.modal.noProducts')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => pick(product.slug)}
                  className="group text-left rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all duration-150 overflow-hidden"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-slate-50 overflow-hidden">
                    {product.thumbnailUrl ? (
                      <img
                        src={product.thumbnailUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
                        <svg className="w-10 h-10 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                      {product.name}
                    </p>
                    {product.minPrice > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t('common.from')} {(product.minPrice / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </p>
                    )}
                    {product.colors?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap items-center">
                        {product.colors.slice(0, 6).map((color) => (
                          <span
                            key={color}
                            className="w-3 h-3 rounded-full border border-white ring-1 ring-slate-200"
                            style={{ background: color.startsWith('#') ? color : color }}
                            title={color}
                          />
                        ))}
                        {product.colors.length > 6 && (
                          <span className="text-[10px] text-slate-400 leading-none">+{product.colors.length - 6}</span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Top Nav ──────────────────────────────────────────────────
function Navbar({ onStartDesigning }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-slate-900 tracking-tight">
          Print<span className="text-indigo-600">Shop</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link to="/products" className="hover:text-indigo-600 transition-colors hidden sm:block">
            {t('nav.products')}
          </Link>
          <a href="#how-it-works" className="hover:text-indigo-600 transition-colors hidden sm:block">
            {t('nav.howItWorks')}
          </a>
          <a href="#contact" className="hover:text-indigo-600 transition-colors hidden sm:block">
            {t('nav.contact')}
          </a>
          {user ? (
            <Link to="/account" className="hover:text-indigo-600 transition-colors hidden sm:block">
              {t('nav.myAccount')}
            </Link>
          ) : (
            <Link to="/login" className="hover:text-indigo-600 transition-colors hidden sm:block">
              {t('nav.signIn')}
            </Link>
          )}
          <LanguageSwitcher />
          <Link
            to="/cart"
            className="p-2 text-slate-500 hover:text-indigo-600 transition-colors"
            title={t('nav.cart')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </Link>
          <button
            onClick={onStartDesigning}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-semibold"
          >
            {t('nav.startDesigning')}
          </button>
        </nav>
      </div>
    </header>
  );
}

// ── How It Works ─────────────────────────────────────────────
function HowItWorks({ onStartDesigning }) {
  const { t } = useTranslation();

  const steps = [
    {
      number: '01',
      title: t('howItWorks.step1.title'),
      body: t('howItWorks.step1.body'),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
      ),
    },
    {
      number: '02',
      title: t('howItWorks.step2.title'),
      body: t('howItWorks.step2.body'),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
      ),
    },
    {
      number: '03',
      title: t('howItWorks.step3.title'),
      body: t('howItWorks.step3.body'),
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
        </svg>
      ),
    },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">{t('howItWorks.heading')}</h2>
          <p className="text-slate-500 text-base max-w-md mx-auto">
            {t('howItWorks.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
          {/* Connector line – desktop only */}
          <div className="hidden sm:block absolute top-10 left-[calc(16.6%+1rem)] right-[calc(16.6%+1rem)] h-px bg-indigo-100" />

          {steps.map((step) => (
            <div key={step.number} className="relative flex flex-col items-center text-center gap-4">
              {/* Icon circle */}
              <div className="relative z-10 w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-indigo-600">
                {step.icon}
              </div>
              <span className="absolute top-0 right-1/2 translate-x-8 -translate-y-2 text-xs font-bold text-indigo-400 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                {step.number}
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={onStartDesigning}
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl transition-all shadow-md shadow-indigo-100 active:scale-[0.98] text-sm"
          >
            {t('howItWorks.cta')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Features Bar ─────────────────────────────────────────────
function FeaturesBar() {
  const { t } = useTranslation();

  const features = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
        </svg>
      ),
      title: t('features.freeShipping.title'),
      body: t('features.freeShipping.body'),
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      ),
      title: t('features.fastTurnaround.title'),
      body: t('features.fastTurnaround.body'),
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
        </svg>
      ),
      title: t('features.premiumQuality.title'),
      body: t('features.premiumQuality.body'),
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      ),
      title: t('features.easyReturns.title'),
      body: t('features.easyReturns.body'),
    },
  ];

  return (
    <section className="py-16 bg-white border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{f.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────
function Footer() {
  const { t } = useTranslation();
  return (
    <footer id="contact" className="bg-slate-900 text-slate-400 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <span className="text-white font-bold text-base">
          Print<span className="text-indigo-400">Shop</span>
        </span>
        <span>{t('home.footer.allRights', { year: new Date().getFullYear() })}</span>
        <div className="flex gap-5">
          <a href="mailto:hello@printshop.com" className="hover:text-white transition-colors">hello@printshop.com</a>
        </div>
      </div>
    </footer>
  );
}

// ── Category placeholder gradients ───────────────────────────
const CATEGORY_COLORS = [
  'from-indigo-400 to-indigo-600',
  'from-violet-400 to-violet-600',
  'from-sky-400 to-sky-600',
  'from-emerald-400 to-emerald-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-pink-400 to-pink-600',
  'from-teal-400 to-teal-600',
  'from-orange-400 to-orange-600',
  'from-cyan-400 to-cyan-600',
  'from-lime-400 to-lime-600',
  'from-fuchsia-400 to-fuchsia-600',
];

// ── Shop by Category ──────────────────────────────────────────
function ShopByCategory() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Skeleton cards while loading
  if (loading) {
    return (
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <div className="h-8 bg-slate-100 rounded w-56 mx-auto mb-3 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded w-72 mx-auto animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-slate-100 animate-pulse">
                <div className="aspect-[4/3] bg-slate-100" />
                <div className="p-3 flex justify-center">
                  <div className="h-4 bg-slate-100 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Nothing to show (no categories seeded yet)
  if (categories.length === 0) return null;

  return (
    <section className="py-16 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3">
            {t('home.shopByCategory.heading')}
          </h2>
          <p className="text-slate-500 text-base max-w-md mx-auto">
            {t('home.shopByCategory.subtitle')}
          </p>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {categories.map((cat, index) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              className="group rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              {/* Image or gradient placeholder */}
              <div className="aspect-[4/3] relative overflow-hidden">
                {cat.image_url ? (
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${CATEGORY_COLORS[index % CATEGORY_COLORS.length]} flex items-center justify-center`}
                  >
                    <svg className="w-10 h-10 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Label */}
              <div className="p-3 bg-white text-center">
                <span className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                  {cat.name}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* View all link */}
        <div className="mt-10 text-center">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold text-sm transition-colors"
          >
            {t('home.shopByCategory.viewAll')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function HomePage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => {})
      .finally(() => setProductsLoading(false));
  }, []);

  function openModal() { setModalOpen(true); }
  function closeModal() { setModalOpen(false); }

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>{t('home.meta.title')}</title>
        <meta name="description" content={t('home.meta.description')} />
        <meta property="og:title" content={t('home.meta.title')} />
        <meta property="og:description" content={t('home.meta.ogDescription')} />
        <meta property="og:type" content="website" />
      </Helmet>
      <Navbar onStartDesigning={openModal} />

      {/* Slim announcement bar */}
      <div className="bg-indigo-600 py-2.5 px-4 text-center text-sm font-medium text-indigo-100">
        {t('announcement.bar')}{' '}
        <button
          onClick={openModal}
          className="text-white font-bold underline underline-offset-2 hover:text-indigo-200 transition-colors"
        >
          {t('announcement.cta')}
        </button>
      </div>

      <main className="flex-1">
        <CatalogView
          products={products}
          loading={productsLoading}
          title={t('home.catalog.title')}
          subtitle={t('home.catalog.subtitle')}
        />
        <ShopByCategory />
        <HowItWorks onStartDesigning={openModal} />
        <FeaturesBar />
      </main>
      <Footer />

      {modalOpen && (
        <ProductPickerModal
          products={products}
          loading={productsLoading}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
