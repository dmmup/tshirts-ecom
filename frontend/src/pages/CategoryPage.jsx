// src/pages/CategoryPage.jsx
import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { fetchCategoryProducts } from '../api/products';
import { useAuth } from '../context/AuthContext';
import CatalogView from '../components/CatalogView';

export default function CategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchCategoryProducts(slug)
      .then(({ category: cat, products: prods }) => {
        setCategory(cat);
        setProducts(prods);
      })
      .catch((err) => {
        if (err.message.includes('not found')) navigate('/products', { replace: true });
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  const breadcrumb = (
    <nav className="flex items-center gap-2 text-xs text-slate-400">
      <Link to="/" className="hover:text-indigo-600 transition-colors">Home</Link>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      <Link to="/products" className="hover:text-indigo-600 transition-colors">Products</Link>
      {category && (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-600 font-medium">{category.name}</span>
        </>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{category ? `${category.name} | PrintShop` : 'PrintShop'}</title>
        {category?.description && <meta name="description" content={category.description} />}
      </Helmet>
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-slate-900 tracking-tight">
            Print<span className="text-indigo-600">Shop</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link to="/products" className="hover:text-indigo-600 transition-colors hidden sm:block">
              Products
            </Link>
            {user ? (
              <Link to="/account" className="hover:text-indigo-600 transition-colors hidden sm:block">
                My Account
              </Link>
            ) : (
              <Link to="/login" className="hover:text-indigo-600 transition-colors hidden sm:block">
                Sign In
              </Link>
            )}
            <Link to="/cart" className="p-2 text-slate-500 hover:text-indigo-600 transition-colors" title="Cart">
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
        title={category?.name || 'Products'}
        subtitle={
          !loading && products.length > 0
            ? `${products.length} product${products.length !== 1 ? 's' : ''} in this category`
            : undefined
        }
        breadcrumb={breadcrumb}
      />
    </div>
  );
}
