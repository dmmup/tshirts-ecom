// src/pages/AdminOrdersPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchAdminOrders } from '../api/admin';
import { AdminTopBar } from './AdminProductsPage';

// ── Helpers ───────────────────────────────────────────────────
function formatPrice(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Status badge ─────────────────────────────────────────────
const STATUS_STYLES = {
  pending:   'bg-amber-100 text-amber-700 border-amber-200',
  paid:      'bg-indigo-100 text-indigo-700 border-indigo-200',
  fulfilled: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
      {status}
    </span>
  );
}

// ── Stat tile ─────────────────────────────────────────────────
function StatTile({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-extrabold text-slate-900">{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function AdminOrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStatus = searchParams.get('status') || '';

  const [data, setData] = useState(null); // { stats, orders, total }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filterTabs = [
    { label: t('admin.orders.filters.all'),       value: '' },
    { label: t('admin.orders.filters.pending'),   value: 'pending' },
    { label: t('admin.orders.filters.paid'),      value: 'paid' },
    { label: t('admin.orders.filters.fulfilled'), value: 'fulfilled' },
    { label: t('admin.orders.filters.cancelled'), value: 'cancelled' },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminOrders({ status: activeStatus || undefined });
      setData(result);
    } catch (err) {
      if (err.status === 401) {
        sessionStorage.removeItem('admin_token');
        navigate('/admin', { replace: true });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [activeStatus, navigate]);

  useEffect(() => {
    if (!sessionStorage.getItem('admin_token')) {
      navigate('/admin', { replace: true });
      return;
    }
    load();
  }, [load, navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    navigate('/admin', { replace: true });
  };

  const setFilter = (val) => {
    if (val) setSearchParams({ status: val });
    else setSearchParams({});
  };

  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminTopBar onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin.orders.heading')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('admin.orders.subtitle')}</p>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatTile label={t('admin.orders.stats.totalOrders')} value={stats.total} />
            <StatTile label={t('admin.orders.stats.paid')} value={stats.paid} sub={t('admin.orders.stats.paidSub')} />
            <StatTile label={t('admin.orders.stats.fulfilled')} value={stats.fulfilled} />
            <StatTile label={t('admin.orders.stats.revenue')} value={formatPrice(stats.revenue_cents)} sub={t('admin.orders.stats.revenueSub')} />
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                activeStatus === tab.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Orders table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="divide-y divide-slate-100">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-28" />
                  <div className="h-4 bg-slate-100 rounded w-36 flex-1" />
                  <div className="h-4 bg-slate-100 rounded w-16" />
                  <div className="h-4 bg-slate-100 rounded w-16" />
                  <div className="h-6 bg-slate-100 rounded-full w-16" />
                </div>
              ))}
            </div>
          ) : data?.orders?.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm font-medium text-slate-500">{t('admin.orders.empty')}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.orders.table.date')}</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.orders.table.customer')}</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">{t('admin.orders.table.items')}</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">{t('admin.orders.table.total')}</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.orders.table.status')}</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                  >
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800">{order.shipping_name || '—'}</p>
                      <p className="text-xs text-slate-400">{order.shipping_email || '—'}</p>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-600 font-medium">
                      {order.item_count}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      {formatPrice(order.subtotal_cents)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-indigo-600 font-semibold text-xs hover:underline">
                        {t('admin.orders.table.view')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination hint */}
        {data && data.total > data?.orders?.length && (
          <p className="text-xs text-center text-slate-400">
            {t('admin.orders.showing', { shown: data.orders.length, total: data.total })}
          </p>
        )}
      </main>
    </div>
  );
}
