// src/pages/ProductCatalogPage.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { fetchProducts } from '../api/products';
import { useAuth } from '../context/AuthContext';
import CatalogView from '../components/CatalogView';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function ProductCatalogPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{t('catalog.meta.title')}</title>
        <meta name="description" content={t('catalog.meta.description')} />
      </Helmet>
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-slate-900 tracking-tight">
            Print<span className="text-indigo-600">Shop</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link to="/products" className="text-indigo-600 font-semibold hidden sm:block">
              {t('nav.products')}
            </Link>
            <a href="/#how-it-works" className="hover:text-indigo-600 transition-colors hidden sm:block">
              {t('nav.howItWorks')}
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
            <Link to="/cart" className="p-2 text-slate-500 hover:text-indigo-600 transition-colors" title={t('nav.cart')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </Link>
          </nav>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        </div>
      )}

      <CatalogView
        products={products}
        loading={loading}
        title={t('catalog.heading')}
        subtitle={t('catalog.subtitle')}
      />
    </div>
  );
}
