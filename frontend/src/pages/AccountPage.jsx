// src/pages/AccountPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold capitalize ${STATUS_STYLES[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  );
}

// ── Orders Tab ─────────────────────────────────────────────────
function OrdersTab({ session }) {
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
        else setError(data.error || 'Could not load orders.');
      })
      .catch(() => setError('Could not load orders.'))
      .finally(() => setLoading(false));
  }, [session]);

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
        <p className="font-medium text-slate-500">No orders yet</p>
        <p className="text-sm mt-1">Your completed orders will appear here.</p>
        <Link to="/products" className="mt-4 inline-block text-indigo-600 hover:underline text-sm font-medium">
          Browse products →
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
                <p className="text-xs text-slate-400 mt-0.5">{order.items?.length ?? 0} item{order.items?.length !== 1 ? 's' : ''}</p>
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
                    <p className="font-medium text-slate-800">{item.productName || 'Custom T-Shirt'}</p>
                    <p className="text-xs text-slate-400">
                      {item.variant?.color_name} · {item.variant?.size} · qty {item.quantity}
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
    if (!res.ok) { setError(data.error || 'Could not save address.'); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const field = (key, label, placeholder, props = {}) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
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
      {saved && <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">Address saved!</div>}

      {field('default_shipping_line1', 'Address', '123 Main St')}
      {field('default_shipping_line2', 'Apartment, suite, etc.', 'Apt 4B (optional)')}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {field('default_shipping_city', 'City', 'New York')}
        {field('default_shipping_state', 'State', 'NY')}
        {field('default_shipping_postal_code', 'ZIP', '10001')}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors text-sm"
      >
        {saving ? 'Saving…' : 'Save address'}
      </button>
    </form>
  );
}

// ── Profile Tab ────────────────────────────────────────────────
function ProfileTab({ user, session }) {
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
    if (!res.ok) { setError(data.error || 'Could not save profile.'); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-10 bg-slate-100 rounded-xl w-64" /><div className="h-10 bg-slate-100 rounded-xl w-64" /></div>;

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-sm">
      {error && <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
      {saved && <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">Profile saved!</div>}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Full name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
          className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Email</label>
        <input
          value={user?.email || ''}
          readOnly
          className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 cursor-not-allowed"
        />
        <p className="text-xs text-slate-400">Email cannot be changed here.</p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors text-sm"
      >
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}

// ── Page ───────────────────────────────────────────────────────
export default function AccountPage() {
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-slate-900 tracking-tight">
            Print<span className="text-indigo-600">Shop</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
            <Link to="/products" className="hover:text-indigo-600 transition-colors hidden sm:block">Products</Link>
            <Link to="/cart" className="p-2 text-slate-500 hover:text-indigo-600 transition-colors" title="Cart">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </Link>
            <button onClick={handleSignOut} className="text-slate-500 hover:text-red-600 transition-colors text-sm font-medium">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900">My Account</h1>
          <p className="text-sm text-slate-500 mt-1">{user.email}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-8 w-fit">
          {[
            { id: 'orders', label: 'Orders' },
            { id: 'address', label: 'Saved Address' },
            { id: 'profile', label: 'Profile' },
          ].map(({ id, label }) => (
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
        {tab === 'address' && <AddressTab session={session} />}
        {tab === 'profile' && <ProfileTab user={user} session={session} />}
      </main>
    </div>
  );
}
