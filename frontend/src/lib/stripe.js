// src/lib/stripe.js
// Stripe.js is loaded lazily (only when actually used)
import { loadStripe } from '@stripe/stripe-js';

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const stripePromise = key ? loadStripe(key) : null;
