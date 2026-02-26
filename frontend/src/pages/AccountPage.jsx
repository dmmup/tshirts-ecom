// src/pages/AccountPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { fetchWishlist } from '../api/products';
import LanguageSwitcher from '../components/LanguageSwitcher';

const API = import.meta.env.VITE_API_URL || '/api';

function formatPrice(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_STYLES = {
  pending:    'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid:       'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-purple-50 text-purple-700 border-purple-200',
  fulfilled:  'bg-green-50 text-green-700 border-green-200',
  shipped:    'bg-green-50 text-green-700 border-green-200',
  cancelled:  'bg-red-50 text-red-700 border-red-200',
};

const STATUS_KEY = {
  pending:    'account.status.pending',
  paid:       'account.status.paid',
  processing: 'account.status.processing',
  fulfilled:  'account.status.fulfilled',
  shipped:    'account.status.shipped',
  cancelled:  'account.status.cancelled',
};

function StatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold capitalize ${STATUS_STYLES[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {t(STATUS_KEY[status] || status)}
    </span>
  );
}

// ── Orders Tab ─────────────────────────────────────────────────
function OrdersTab({ session }) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API}/account/orders`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setOrders(data);
        else setError(data.error || t('account.orders.couldNotLoad'));
      })
      .catch(() => setError(t('account.orders.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [session, t]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <p className="font-medium text-slate-500">{t('account.orders.empty.heading')}</p>
        <p className="text-sm mt-1">{t('account.orders.empty.body')}</p>
        <Link to="/products" className="mt-4 inline-block text-indigo-600 hover:underline text-sm font-medium">
          {t('account.orders.empty.cta')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === order.id ? null : order.id)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">{formatDate(order.created_at)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('account.orders.itemCount', { count: order.items?.length ?? 0 })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <StatusBadge status={order.status} />
              <p className="text-sm font-bold text-slate-900">{formatPrice(order.subtotal_cents)}</p>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${expanded === order.id ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expanded === order.id && (
            <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-2">
              {(order.items || []).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{item.productName || t('checkout.summary.defaultProduct')}</p>
                    <p className="text-xs text-slate-400">
                      {item.variant?.color_name} · {item.variant?.size} · {t('account.orders.qty', { n: item.quantity })}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-700">{formatPrice(item.price_cents * item.quantity)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Address Tab ────────────────────────────────────────────────
function AddressTab({ session }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    default_shipping_line1: '',
    default_shipping_line2: '',
    default_shipping_city: '',
    default_shipping_state: '',
    default_shipping_postal_code: '',
    default_shipping_country: 'US',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API}/account/profile`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setForm((f) => ({
            ...f,
            default_shipping_line1: data.default_shipping_line1 || '',
            default_shipping_line2: data.default_shipping_line2 || '',
            default_shipping_city: data.default_shipping_city || '',
            default_shipping_state: data.default_shipping_state || '',
            default_shipping_postal_code: data.default_shipping_postal_code || '',
            default_shipping_country: data.default_shipping_country || 'US',
          }));
        }
      })
      .finally(() => setLoading(false));
  }, [session]);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(`${API}/account/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || t('account.couldNotSaveAddress')); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const field = (key, labelKey, placeholder, props = {}) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t(labelKey)}</label>
      <input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
        {...props}
      />
    </div>
  );

  if (loading) return <div className="animate-pulse space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-xl" />)}</div>;

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-lg">
      {error && <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
      {saved && <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{t('account.address.saved')}</div>}

      {field('default_shipping_line1', 'checkout.shipping.address', '123 Main St')}
      {field('default_shipping_line2', 'account.address.apartment', 'Apt 4B')}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {field('default_shipping_city', 'account.address.city', 'New York')}
        {field('default_shipping_state', 'account.address.state', 'NY')}
        {field('default_shipping_postal_code', 'account.address.zip', '10001')}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors text-sm"
      >
        {saving ? t('common.saving') : t('account.address.saveButton')}
      </button>
    </form>
  );
}

// ── Wishlist Tab ───────────────────────────────────────────────
function WishlistTab({ session }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toggle } = useWishlist();

  useEffect(() => {
    if (!session?.access_token) return;
    fetchWishlist(session.access_token)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [session]);

  function handleRemove(productId) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
    toggle(productId); // also updates global context
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-slate-100 aspect-[4/5]" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <p className="font-medium text-slate-500">{t('account.wishlist.empty.heading')}</p>
        <p className="text-sm mt-1">{t('account.wishlist.empty.body')}</p>
        <Link to="/products" className="mt-4 inline-block text-indigo-600 hover:underline text-sm font-medium">
          {t('account.wishlist.empty.cta')}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {items.map((item) => (
        <div key={item.productId} className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <Link to={`/products/${item.slug}`}>
            {item.thumbnailUrl ? (
              <img src={item.thumbnailUrl} alt={item.name} className="w-full aspect-[4/5] object-cover" />
            ) : (
              <div className="w-full aspect-[4/5] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">{item.name}</p>
              {item.minPrice && (
                <p className="text-xs text-slate-500 mt-0.5">{t('common.from')} {(item.minPrice / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
              )}
            </div>
          </Link>
          {/* Remove heart button */}
          <button
            onClick={() => handleRemove(item.productId)}
            aria-label={t('common.remove')}
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/90 text-rose-500 shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Profile Tab ────────────────────────────────────────────────
function ProfileTab({ user, session }) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API}/account/profile`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setFullName(data.full_name || '');
      })
      .finally(() => setLoading(false));
  }, [session]);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(`${API}/account/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ full_name: fullName }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || t('account.couldNotSaveProfile')); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-10 bg-slate-100 rounded-xl w-64" /><div className="h-10 bg-slate-100 rounded-xl w-64" /></div>;

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-sm">
      {error && <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
      {saved && <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{t('account.profile.saved')}</div>}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t('account.profile.fullName')}</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t('account.profile.fullName')}
          className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t('account.profile.email')}</label>
        <input
          value={user?.email || ''}
          readOnly
          className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 cursor-not-allowed"
        />
        <p className="text-xs text-slate-400">{t('account.profile.emailReadonly')}</p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors text-sm"
      >
        {saving ? t('common.saving') : t('account.profile.saveButton')}
      </button>
    </form>
  );
}

// ── Page ───────────────────────────────────────────────────────
export default function AccountPage() {
  const { t } = useTranslation();
  const { user, session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('orders');

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true });
  }, [user, loading, navigate]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/', { replace: true });
  }, [signOut, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'orders', label: t('account.tabs.orders') },
    { id: 'wishlist', label: t('account.tabs.wishlist') },
    { id: 'address', label: t('account.tabs.address') },
    { id: 'profile', label: t('account.tabs.profile') },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{t('account.meta.title')}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-slate-900 tracking-tight">
            Print<span className="text-indigo-600">Shop</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
            <Link to="/products" className="hover:text-indigo-600 transition-colors hidden sm:block">{t('nav.products')}</Link>
            <LanguageSwitcher />
            <Link to="/cart" className="p-2 text-slate-500 hover:text-indigo-600 transition-colors" title={t('nav.cart')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </Link>
            <button onClick={handleSignOut} className="text-slate-500 hover:text-red-600 transition-colors text-sm font-medium">
              {t('nav.signOut')}
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900">{t('account.heading')}</h1>
          <p className="text-sm text-slate-500 mt-1">{user.email}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-8 w-fit">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'orders' && <OrdersTab session={session} />}
        {tab === 'wishlist' && <WishlistTab session={session} />}
        {tab === 'address' && <AddressTab session={session} />}
        {tab === 'profile' && <ProfileTab user={user} session={session} />}
      </main>
    </div>
  );
}
