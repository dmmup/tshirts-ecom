// src/pages/LoginPage.jsx
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const API = import.meta.env.VITE_API_URL || '/api';

const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition";

// ── Field wrapper ─────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, loading, signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/account';

  // 'signin' | 'signup-form' | 'verify'
  const [tab, setTab] = useState('signin');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // ── Sign in fields ──────────────────────────────────────────
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');

  // ── Sign up fields ──────────────────────────────────────────
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPhone, setSuPhone] = useState('');
  const [suLine1, setSuLine1] = useState('');
  const [suLine2, setSuLine2] = useState('');
  const [suCity, setSuCity] = useState('');
  const [suState, setSuState] = useState('');
  const [suPostal, setSuPostal] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm, setSuConfirm] = useState('');

  // ── OTP fields ──────────────────────────────────────────────
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);
  const [resendCooldown, setResendCooldown] = useState(0);

  // If already logged in, redirect
  useEffect(() => {
    if (!loading && user) navigate(redirect, { replace: true });
  }, [user, loading, navigate, redirect]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // ── Handlers ─────────────────────────────────────────────────

  async function handleSignIn(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await signIn(siEmail, siPassword);
    if (err) { setError(err.message); setBusy(false); return; }
    navigate(redirect, { replace: true });
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    setError(null);

    if (suPassword !== suConfirm) { setError(t('login.validation.passwordMismatch')); return; }
    if (suPassword.length < 6) { setError(t('login.validation.passwordTooShort')); return; }

    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: suEmail.trim(),
          password: suPassword,
          name: suName.trim(),
          phone: suPhone.trim(),
          line1: suLine1.trim(),
          line2: suLine2.trim(),
          city: suCity.trim(),
          state: suState.trim(),
          postal: suPostal.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('login.couldNotSend')); setBusy(false); return; }
      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(60);
      setTab('verify');
    } catch {
      setError(t('login.networkError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) { setError(t('login.validation.codeIncomplete')); return; }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/verify-and-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: suEmail.trim(), code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('login.verificationFailed')); setBusy(false); return; }

      // Auto sign-in
      const { error: signInErr } = await signIn(suEmail.trim(), suPassword);
      if (signInErr) { setError(signInErr.message); setBusy(false); return; }
      navigate(redirect, { replace: true });
    } catch {
      setError(t('login.networkError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: suEmail.trim(), password: suPassword,
          name: suName.trim(), phone: suPhone.trim(),
          line1: suLine1.trim(), line2: suLine2.trim(),
          city: suCity.trim(), state: suState.trim(), postal: suPostal.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('login.couldNotResend')); return; }
      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(60);
    } catch {
      setError(t('login.networkError'));
    } finally {
      setBusy(false);
    }
  }

  // Handle OTP digit input
  function handleOtpChange(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) next[i] = text[i] || '';
    setOtpDigits(next);
    otpRefs.current[Math.min(text.length, 5)]?.focus();
  }

  function switchTab(newTab) {
    setTab(newTab);
    setError(null);
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Helmet>
        <title>{t('login.meta.title')}</title>
        <meta name="description" content={t('login.meta.description')} />
      </Helmet>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-slate-900 tracking-tight">
            Print<span className="text-indigo-600">Shop</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link to="/products" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium">
              {t('login.backToProducts')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* ── Verify step ── */}
          {tab === 'verify' ? (
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900">{t('login.verify.heading')}</h1>
                <p className="mt-2 text-slate-500 text-sm">
                  {t('login.verify.body', { email: suEmail })}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-6">
                {error && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
                )}

                <form onSubmit={handleVerify} className="space-y-6">
                  {/* OTP input */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-3">
                      {t('login.verify.label')}
                    </label>
                    <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                      {otpDigits.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => (otpRefs.current[i] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                        />
                      ))}
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-2">{t('login.verify.expires')}</p>
                  </div>

                  <button
                    type="submit"
                    disabled={busy || otpDigits.join('').length < 6}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    {busy ? t('login.verify.verifying') : t('login.verify.verify')}
                  </button>
                </form>

                <div className="text-center space-y-2">
                  <p className="text-sm text-slate-500">
                    {t('login.verify.noCode')}{' '}
                    <button
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || busy}
                      className="text-indigo-600 hover:underline font-medium disabled:text-slate-400 disabled:no-underline"
                    >
                      {resendCooldown > 0
                        ? t('login.verify.resendIn', { seconds: resendCooldown })
                        : t('login.verify.resend')}
                    </button>
                  </p>
                  <button
                    onClick={() => switchTab('signup-form')}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {t('login.verify.changeEmail')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-extrabold text-slate-900">
                  {tab === 'signin' ? t('login.welcomeBack') : t('login.createAccount')}
                </h1>
                <p className="mt-2 text-slate-500 text-sm">
                  {tab === 'signin' ? t('login.signInSubtitle') : t('login.signUpSubtitle')}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-6">
                {/* Tab toggle */}
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => switchTab('signin')}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      tab === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('login.tabs.signIn')}
                  </button>
                  <button
                    onClick={() => switchTab('signup-form')}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      tab === 'signup-form' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('login.tabs.signUp')}
                  </button>
                </div>

                {error && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
                )}

                {/* ── Sign In form ── */}
                {tab === 'signin' && (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <Field label={t('login.fields.email')}>
                      <input type="email" required autoComplete="email" value={siEmail}
                        onChange={(e) => setSiEmail(e.target.value)}
                        placeholder="you@example.com" className={inputCls} />
                    </Field>
                    <Field label={t('login.fields.password')}>
                      <input type="password" required autoComplete="current-password" value={siPassword}
                        onChange={(e) => setSiPassword(e.target.value)}
                        placeholder="••••••••" className={inputCls} />
                    </Field>
                    <button type="submit" disabled={busy}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors text-sm">
                      {busy ? t('login.buttons.signingIn') : t('login.buttons.signIn')}
                    </button>
                  </form>
                )}

                {/* ── Sign Up form ── */}
                {tab === 'signup-form' && (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    {/* Personal info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Field label={t('login.fields.fullName')}>
                          <input type="text" required autoComplete="name" value={suName}
                            onChange={(e) => setSuName(e.target.value)}
                            placeholder="Jane Smith" className={inputCls} />
                        </Field>
                      </div>
                      <div className="col-span-2">
                        <Field label={`${t('login.fields.email')} *`}>
                          <input type="email" required autoComplete="email" value={suEmail}
                            onChange={(e) => setSuEmail(e.target.value)}
                            placeholder="you@example.com" className={inputCls} />
                        </Field>
                      </div>
                      <div className="col-span-2">
                        <Field label={t('login.fields.phoneNumber')}>
                          <input type="tel" autoComplete="tel" value={suPhone}
                            onChange={(e) => setSuPhone(e.target.value)}
                            placeholder="+1 (555) 000-0000" className={inputCls} />
                        </Field>
                      </div>
                    </div>

                    {/* Shipping address */}
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {t('login.fields.shippingSection')}{' '}
                        <span className="font-normal normal-case text-slate-400">{t('login.fields.shippingOptional')}</span>
                      </p>
                      <Field label={t('login.fields.addressLine1')}>
                        <input type="text" autoComplete="address-line1" value={suLine1}
                          onChange={(e) => setSuLine1(e.target.value)}
                          placeholder="123 Main St" className={inputCls} />
                      </Field>
                      <Field label={t('login.fields.addressLine2')}>
                        <input type="text" autoComplete="address-line2" value={suLine2}
                          onChange={(e) => setSuLine2(e.target.value)}
                          placeholder="Apt 4B" className={inputCls} />
                      </Field>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <Field label={t('login.fields.city')}>
                            <input type="text" autoComplete="address-level2" value={suCity}
                              onChange={(e) => setSuCity(e.target.value)}
                              placeholder="New York" className={inputCls} />
                          </Field>
                        </div>
                        <div>
                          <Field label={t('login.fields.state')}>
                            <input type="text" autoComplete="address-level1" value={suState}
                              onChange={(e) => setSuState(e.target.value)}
                              placeholder="NY" className={inputCls} />
                          </Field>
                        </div>
                        <div>
                          <Field label={t('login.fields.zip')}>
                            <input type="text" autoComplete="postal-code" value={suPostal}
                              onChange={(e) => setSuPostal(e.target.value)}
                              placeholder="10001" className={inputCls} />
                          </Field>
                        </div>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <Field label={t('login.fields.passwordMin')}>
                        <input type="password" required autoComplete="new-password" minLength={6}
                          value={suPassword} onChange={(e) => setSuPassword(e.target.value)}
                          placeholder={t('login.fields.passwordPlaceholder')} className={inputCls} />
                      </Field>
                      <Field label={t('login.fields.confirmPassword')}>
                        <input type="password" required autoComplete="new-password"
                          value={suConfirm} onChange={(e) => setSuConfirm(e.target.value)}
                          placeholder="••••••••" className={inputCls} />
                      </Field>
                    </div>

                    <button type="submit" disabled={busy}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors text-sm">
                      {busy ? t('login.buttons.sendingCode') : t('login.buttons.sendCode')}
                    </button>
                  </form>
                )}

                {/* Divider + Google */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 font-medium">{t('login.divider')}</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <button
                  onClick={() => { setError(null); signInWithGoogle(); }}
                  className="w-full flex items-center justify-center gap-3 py-2.5 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {t('login.buttons.continueGoogle')}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
