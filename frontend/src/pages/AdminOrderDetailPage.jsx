// src/pages/AdminOrderDetailPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchAdminOrder, updateOrderStatus } from '../api/admin';
import { AdminTopBar } from './AdminProductsPage';

// ── Helpers ───────────────────────────────────────────────────
function formatPrice(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

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

// ── Info card ─────────────────────────────────────────────────
function InfoCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function AdminOrderDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminOrder(id);
      setOrder(data.order);
      setItems(data.items || []);
      setSelectedStatus(data.order.status);
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
  }, [id, navigate]);

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

  const handleStatusUpdate = async () => {
    if (!selectedStatus || selectedStatus === order.status) return;
    setUpdating(true);
    setUpdateSuccess(false);
    try {
      const { order: updated } = await updateOrderStatus(id, selectedStatus);
      setOrder(updated);
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 2500);
    } catch (err) {
      if (err.status === 401) {
        sessionStorage.removeItem('admin_token');
        navigate('/admin', { replace: true });
      } else {
        setError(err.message);
      }
    } finally {
      setUpdating(false);
    }
  };

  const shortId = id?.slice(0, 8).toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <svg className="w-8 h-8 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminTopBar onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Back + Header */}
        <div>
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('admin.orderDetail.backToOrders')}
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{t('admin.orderDetail.orderNumber', { id: shortId })}</h1>
            {order && <StatusBadge status={order.status} />}
          </div>
          {order && (
            <p className="text-sm text-slate-500 mt-1">{formatDate(order.created_at)}</p>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {order && (
          <>
            {/* Status update */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-slate-700">{t('admin.orderDetail.updateStatus')}</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="pending">{t('admin.orderDetail.statusOptions.pending')}</option>
                <option value="paid">{t('admin.orderDetail.statusOptions.paid')}</option>
                <option value="fulfilled">{t('admin.orderDetail.statusOptions.fulfilled')}</option>
                <option value="cancelled">{t('admin.orderDetail.statusOptions.cancelled')}</option>
              </select>
              <button
                onClick={handleStatusUpdate}
                disabled={updating || selectedStatus === order.status}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {updating ? t('admin.orderDetail.saving') : t('admin.orderDetail.saveStatus')}
              </button>
              {updateSuccess && (
                <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('admin.orderDetail.updated')}
                </span>
              )}
            </div>

            {/* Customer + Payment info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoCard title={t('admin.orderDetail.cards.shippingAddress')}>
                <div className="text-sm text-slate-800 space-y-1">
                  <p className="font-semibold">{order.shipping_name || '—'}</p>
                  <p className="text-slate-500">{order.shipping_email || '—'}</p>
                  {order.shipping_line1 && (
                    <>
                      <p>{order.shipping_line1}</p>
                      {order.shipping_line2 && <p>{order.shipping_line2}</p>}
                      <p>
                        {[order.shipping_city, order.shipping_state, order.shipping_postal_code]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      <p>{order.shipping_country}</p>
                    </>
                  )}
                </div>
              </InfoCard>

              <InfoCard title={t('admin.orderDetail.cards.payment')}>
                <div className="text-sm space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('admin.orderDetail.cards.amountPaid')}</span>
                    <span className="font-bold text-slate-900">{formatPrice(order.subtotal_cents)}</span>
                  </div>
                  {order.stripe_payment_intent_id && (
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-slate-500 flex-shrink-0">{t('admin.orderDetail.cards.stripePI')}</span>
                      <a
                        href={`https://dashboard.stripe.com/test/payments/${order.stripe_payment_intent_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline font-mono text-xs truncate"
                      >
                        {order.stripe_payment_intent_id}
                      </a>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('admin.orderDetail.cards.status')}</span>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              </InfoCard>
            </div>

            {/* Order items table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">
                  {t('admin.orderDetail.items.heading', { count: items.length })}
                </h3>
              </div>

              {items.length === 0 ? (
                <p className="px-6 py-8 text-sm text-slate-400 text-center">{t('admin.orderDetail.items.empty')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left">
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.orderDetail.items.columns.product')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin.orderDetail.items.columns.design')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">{t('admin.orderDetail.items.columns.qty')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">{t('admin.orderDetail.items.columns.unit')}</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">{t('admin.orderDetail.items.columns.total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const decorLabel = item.config?.decoration
                        ? t(`product.decoration.${item.config.decoration}`, { defaultValue: item.config.decoration })
                        : '—';
                      const designPreview = item.config?.design_preview_url
                        || item.config?.front?.design_preview_url
                        || item.config?.back?.design_preview_url
                        || null;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          {/* Product + color/size */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {/* Thumbnail */}
                              <div className="w-12 h-14 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                                {item.thumbnailUrl ? (
                                  <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-slate-100" />
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">
                                  {item.product?.name || t('product.customTShirt')}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {item.config?.color && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                                      <span
                                        className="w-2 h-2 rounded-full border border-slate-300"
                                        style={{ backgroundColor: item.variant?.color_hex || '#e2e8f0' }}
                                      />
                                      {item.config.color}
                                    </span>
                                  )}
                                  {item.config?.size && (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                                      {item.config.size}
                                    </span>
                                  )}
                                  {item.config?.decoration && (
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
                                      {decorLabel}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Design preview */}
                          <td className="px-6 py-4">
                            {designPreview ? (
                              <img
                                src={designPreview}
                                alt="Design"
                                className="w-10 h-10 rounded object-contain bg-slate-50 border border-slate-200"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-center text-slate-700 font-medium">
                            {item.quantity}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-600">
                            {formatPrice(item.price_cents)}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-slate-900">
                            {formatPrice(item.price_cents * item.quantity)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Footer total */}
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td colSpan={4} className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                        {t('admin.orderDetail.items.orderTotal')}
                      </td>
                      <td className="px-6 py-4 text-right text-base font-extrabold text-slate-900">
                        {formatPrice(order.subtotal_cents)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
