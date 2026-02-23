// src/pages/HomePage.jsx
import { Link } from 'react-router-dom';

// ── Top Nav ──────────────────────────────────────────────────
function Navbar() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-slate-900 tracking-tight">
          Print<span className="text-indigo-600">Shop</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link to="/products/gildan-budget-unisex-tshirt" className="hover:text-indigo-600 transition-colors hidden sm:block">
            Products
          </Link>
          <a href="#how-it-works" className="hover:text-indigo-600 transition-colors hidden sm:block">
            How it works
          </a>
          <a href="#contact" className="hover:text-indigo-600 transition-colors hidden sm:block">
            Contact
          </a>
          <Link
            to="/products/gildan-budget-unisex-tshirt"
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-semibold"
          >
            Start designing
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Decorative blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-36 text-center">
        <span className="inline-block mb-5 px-3.5 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-widest uppercase border border-indigo-500/30">
          Custom apparel, made easy
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
          Your design.<br className="hidden sm:block" />
          <span className="text-indigo-400">Your style.</span>
        </h1>
        <p className="max-w-xl mx-auto text-slate-400 text-lg leading-relaxed mb-10">
          Upload your artwork, pick a color and size, and we'll print and ship
          premium custom T-shirts straight to your door.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/products/gildan-budget-unisex-tshirt"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-indigo-900/40 active:scale-[0.98] text-base"
          >
            Start designing
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-2xl transition-all border border-white/20 active:scale-[0.98] text-base"
          >
            See how it works
          </a>
        </div>

        {/* Social proof strip */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="text-amber-400">★★★★★</span>
            4.8 / 5 from 2,400+ orders
          </span>
          <span className="hidden sm:block text-slate-700">|</span>
          <span>Ships in 3–5 business days</span>
          <span className="hidden sm:block text-slate-700">|</span>
          <span>No minimum order</span>
        </div>
      </div>
    </section>
  );
}

// ── How It Works ─────────────────────────────────────────────
const STEPS = [
  {
    number: '01',
    title: 'Choose your product',
    body: 'Browse our catalog of premium blank apparel. Pick the style, color, and size that fits your vision.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Upload your design',
    body: 'Drop in your PNG, SVG, or JPEG artwork. We support files up to 20MB — no design skills required.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
      </svg>
    ),
  },
  {
    number: '03',
    title: 'We print & ship',
    body: 'Our team prints your order using Direct-to-Garment, embroidery, or screen print — and ships it fast.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
      </svg>
    ),
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">How it works</h2>
          <p className="text-slate-500 text-base max-w-md mx-auto">
            From blank shirt to delivered order in three simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
          {/* Connector line – desktop only */}
          <div className="hidden sm:block absolute top-10 left-[calc(16.6%+1rem)] right-[calc(16.6%+1rem)] h-px bg-indigo-100" />

          {STEPS.map((step) => (
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
          <Link
            to="/products/gildan-budget-unisex-tshirt"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl transition-all shadow-md shadow-indigo-100 active:scale-[0.98] text-sm"
          >
            Get started now
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Features Bar ─────────────────────────────────────────────
const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
      </svg>
    ),
    title: 'Free shipping',
    body: 'On all orders over $50',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
    ),
    title: 'Fast turnaround',
    body: 'Printed and shipped in 48h',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
      </svg>
    ),
    title: 'Premium quality',
    body: 'Industry-leading print durability',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
    ),
    title: 'Easy returns',
    body: '30-day hassle-free returns',
  },
];

function FeaturesBar() {
  return (
    <section className="py-16 bg-white border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {FEATURES.map((f) => (
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
  return (
    <footer id="contact" className="bg-slate-900 text-slate-400 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <span className="text-white font-bold text-base">
          Print<span className="text-indigo-400">Shop</span>
        </span>
        <span>© {new Date().getFullYear()} PrintShop. All rights reserved.</span>
        <div className="flex gap-5">
          <a href="mailto:hello@printshop.com" className="hover:text-white transition-colors">hello@printshop.com</a>
        </div>
      </div>
    </footer>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <FeaturesBar />
      </main>
      <Footer />
    </div>
  );
}
