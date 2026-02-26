// src/pages/OrderConfirmationPage.jsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { stripePromise } from '../lib/stripe';

function formatPrice(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function OrderConfirmationPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading | success | processing | error
  const [amount, setAmount] = useState(null);
  const [email, setEmail] = useState(null);

  const clientSecret = searchParams.get('payment_intent_client_secret');

  useEffect(() => {
    if (!stripePromise || !clientSecret) {
      setStatus('success');
      return;
    }

    stripePromise.then(async (stripe) => {
      if (!stripe) { setStatus('success'); return; }

      try {
        const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret);
        if (error) { setStatus('error'); return; }

        if (paymentIntent.status === 'succeeded') {
          setAmount(paymentIntent.amount);
          setEmail(paymentIntent.receipt_email);
          setStatus('success');
        } else if (paymentIntent.status === 'processing') {
          setStatus('processing');
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('success');
      }
    });
  }, [clientSecret]);

  const steps = [
    { label: t('orderConfirmation.whatNext.step1.label'), done: true,  body: t('orderConfirmation.whatNext.step1.body') },
    { label: t('orderConfirmation.whatNext.step2.label'), done: false, body: t('orderConfirmation.whatNext.step2.body') },
    { label: t('orderConfirmation.whatNext.step3.label'), done: false, body: t('orderConfirmation.whatNext.step3.body') },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{t('orderConfirmation.meta.title')}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      {/* Top bar */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <Link to="/" className="text-xl font-bold text-slate-900 tracking-tight">
            Print<span className="text-indigo-600">Shop</span>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        {status === 'loading' && (
          <div className="flex justify-center">
            <svg className="w-10 h-10 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-6">
            {/* Success icon */}
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-slate-900">{t('orderConfirmation.success.heading')}</h1>
              <p className="text-slate-500 text-base leading-relaxed">
                {email ? (
                  t('orderConfirmation.success.bodyWithEmail', { email })
                ) : (
                  t('orderConfirmation.success.bodyNoEmail')
                )}
              </p>
            </div>

            {amount && (
              <div className="bg-white rounded-2xl border border-slate-200 px-8 py-5 flex flex-col items-center gap-1">
                <span className="text-sm text-slate-500">{t('orderConfirmation.success.amountCharged')}</span>
                <span className="text-2xl font-bold text-slate-900">{formatPrice(amount)}</span>
              </div>
            )}

            {/* Timeline */}
            <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 text-left">
              <h2 className="font-bold text-slate-800 mb-4 text-sm">{t('orderConfirmation.whatNext.heading')}</h2>
              <ol className="space-y-3">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                      step.done ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {step.done ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (i + 1)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{step.label}</p>
                      <p className="text-xs text-slate-500">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              <Link
                to="/products/gildan-budget-unisex-tshirt"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                {t('orderConfirmation.success.orderAnother')}
              </Link>
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors text-sm border border-slate-200"
              >
                {t('orderConfirmation.success.backToHome')}
              </Link>
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">{t('orderConfirmation.processing.heading')}</h1>
              <p className="text-slate-500">{t('orderConfirmation.processing.body')}</p>
            </div>
            <Link to="/" className="text-indigo-600 hover:underline text-sm font-medium">
              {t('orderConfirmation.processing.backToHome')}
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">{t('orderConfirmation.failed.heading')}</h1>
              <p className="text-slate-500">{t('orderConfirmation.failed.body')}</p>
            </div>
            <Link
              to="/checkout"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm"
            >
              {t('orderConfirmation.failed.backToHome')}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
