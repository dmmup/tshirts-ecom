// src/pages/CheckoutPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { stripePromise } from '../lib/stripe';
import { fetchCart, createPaymentIntent } from '../api/products';

// ── Helpers ───────────────────────────────────────────────────
function getAnonymousId() {
  return localStorage.getItem('pdp_anon_id');
}

function formatPrice(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ── Order Summary Sidebar ────────────────────────────────────
function OrderSummary({ items, totalCents }) {
  const itemCount = items.reduce((a, i) => a + i.quantity, 0);

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
      <h2 className="font-bold text-slate-900 text-base">Order summary</h2>

      {/* Item list */}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            {/* Thumbnail */}
            <div className="w-12 h-14 rounded-lg bg-slate-200 overflow-hidden flex-shrink-0">
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt={item.product?.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-200" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {item.product?.name || 'Custom T-Shirt'}
              </p>
              <p className="text-xs text-slate-500">
                {item.config?.color} · {item.config?.size} · qty {item.quantity}
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-800 flex-shrink-0">
              {formatPrice((item.variant?.price_cents ?? 0) * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
          <span className="font-semibold text-slate-800">{formatPrice(totalCents)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Shipping</span>
          <span className="text-green-600 font-medium">Free</span>
        </div>
        <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
          <span>Total</span>
          <span>{formatPrice(totalCents)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Shipping Form ─────────────────────────────────────────────
function ShippingForm({ value, onChange }) {
  const field = (name, label, placeholder, props = {}) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      <input
        name={name}
        value={value[name] || ''}
        onChange={(e) => onChange({ ...value, [name]: e.target.value })}
        placeholder={placeholder}
        className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
        {...props}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-bold text-slate-900 text-base">Shipping information</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('name', 'Full name', 'Jane Doe', { required: true, autoComplete: 'name' })}
        {field('email', 'Email', 'jane@example.com', { required: true, type: 'email', autoComplete: 'email' })}
      </div>
      {field('line1', 'Address', '123 Main St', { required: true, autoComplete: 'address-line1' })}
      {field('line2', 'Apartment, suite, etc.', 'Apt 4B (optional)', { autoComplete: 'address-line2' })}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {field('city', 'City', 'New York', { required: true, autoComplete: 'address-level2' })}
        {field('state', 'State', 'NY', { required: true, autoComplete: 'address-level1' })}
        {field('postal_code', 'ZIP', '10001', { required: true, autoComplete: 'postal-code' })}
      </div>
    </div>
  );
}

// ── Inner Payment Form (must be inside <Elements>) ───────────
function PaymentForm({ totalCents, shipping, onShippingChange, items, clientSecret }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    // Basic shipping validation
    const required = ['name', 'email', 'line1', 'city', 'state', 'postal_code'];
    for (const field of required) {
      if (!shipping[field]?.trim()) {
        setPayError(`Please fill in your ${field.replace('_', ' ')}.`);
        return;
      }
    }

    setSubmitting(true);
    setPayError(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-confirmation`,
        shipping: {
          name: shipping.name,
          address: {
            line1: shipping.line1,
            line2: shipping.line2 || '',
            city: shipping.city,
            state: shipping.state,
            postal_code: shipping.postal_code,
            country: 'US',
          },
        },
        receipt_email: shipping.email,
      },
      redirect: 'if_required',
    });

    if (error) {
      setPayError(error.message);
      setSubmitting(false);
      return;
    }

    // No redirect needed (card payment succeeded inline)
    if (paymentIntent?.status === 'succeeded') {
      navigate(`/order-confirmation?payment_intent=${paymentIntent.id}&payment_intent_client_secret=${clientSecret}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Shipping section */}
      <ShippingForm value={shipping} onChange={onShippingChange} />

      {/* Payment section */}
      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-slate-900 text-base">Payment</h2>
        <div className="p-4 rounded-2xl border border-slate-200 bg-white">
          <PaymentElement
            options={{
              layout: 'tabs',
            }}
          />
        </div>
      </div>

      {payError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {payError}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl transition-colors text-base active:scale-[0.99] flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Pay {formatPrice(totalCents)}
          </>
        )}
      </button>

      <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Secured by Stripe · Your payment info is never stored on our servers
      </p>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function CheckoutPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [clientSecret, setClientSecret] = useState(null);
  const [totalCents, setTotalCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shipping, setShipping] = useState({
    name: '', email: '', line1: '', line2: '',
    city: '', state: '', postal_code: '', country: 'US',
  });

  const anonymousId = getAnonymousId();

  const bootstrap = useCallback(async () => {
    if (!anonymousId) {
      navigate('/cart');
      return;
    }

    try {
      // Load cart for display
      const { items: fetched } = await fetchCart(anonymousId);
      if (!fetched || fetched.length === 0) {
        navigate('/cart');
        return;
      }
      setItems(fetched);

      // Create PaymentIntent
      const { clientSecret: cs, totalCents: total } = await createPaymentIntent({ anonymousId });
      setClientSecret(cs);
      setTotalCents(total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [anonymousId, navigate]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (!stripePromise) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md text-center space-y-3">
          <p className="text-2xl font-bold text-slate-800">Checkout unavailable</p>
          <p className="text-slate-500 text-sm">
            Stripe is not configured. Add <code className="bg-slate-100 px-1 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code> to{' '}
            <code className="bg-slate-100 px-1 rounded">frontend/.env</code> and{' '}
            <code className="bg-slate-100 px-1 rounded">STRIPE_SECRET_KEY</code> to{' '}
            <code className="bg-slate-100 px-1 rounded">backend/.env</code>.
          </p>
          <Link to="/cart" className="inline-block text-indigo-600 hover:underline text-sm font-medium">
            ← Back to cart
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-slate-900 tracking-tight">
            Print<span className="text-indigo-600">Shop</span>
          </Link>
          <Link to="/cart" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium">
            ← Back to cart
          </Link>
        </div>
      </header>

      {/* Progress breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="text-indigo-600 font-semibold">Cart</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-800 font-semibold">Checkout</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span>Confirmation</span>
        </nav>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error ? (
          <div className="max-w-lg mx-auto mt-12 text-center space-y-4">
            <p className="text-lg font-semibold text-slate-800">Something went wrong</p>
            <p className="text-sm text-slate-500">{error}</p>
            <Link to="/cart" className="inline-block text-indigo-600 hover:underline text-sm font-medium">
              ← Back to cart
            </Link>
          </div>
        ) : loading ? (
          <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
            {/* Skeleton form */}
            <div className="bg-white rounded-2xl border border-slate-100 p-8 animate-pulse space-y-5">
              <div className="h-5 bg-slate-100 rounded w-40" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-slate-100 rounded-xl" />
                <div className="h-10 bg-slate-100 rounded-xl" />
              </div>
              <div className="h-10 bg-slate-100 rounded-xl" />
              <div className="h-10 bg-slate-100 rounded-xl" />
              <div className="h-5 bg-slate-100 rounded w-32 mt-4" />
              <div className="h-28 bg-slate-100 rounded-2xl" />
              <div className="h-12 bg-indigo-100 rounded-2xl" />
            </div>
            {/* Skeleton summary */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 animate-pulse space-y-4">
              <div className="h-5 bg-slate-200 rounded w-32" />
              <div className="h-14 bg-slate-200 rounded-xl" />
              <div className="h-14 bg-slate-200 rounded-xl" />
              <div className="h-px bg-slate-200" />
              <div className="h-5 bg-slate-200 rounded w-full" />
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
            {/* Left: form wrapped in Elements */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#4f46e5',
                      borderRadius: '12px',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    },
                  },
                }}
              >
                <PaymentForm
                  totalCents={totalCents}
                  shipping={shipping}
                  onShippingChange={setShipping}
                  items={items}
                  clientSecret={clientSecret}
                />
              </Elements>
            </div>

            {/* Right: order summary */}
            <div className="lg:sticky lg:top-24">
              <OrderSummary items={items} totalCents={totalCents} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
