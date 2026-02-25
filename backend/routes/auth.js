// backend/routes/auth.js
// ─────────────────────────────────────────────────────────────
// Auth Routes — public
// Mounted at: /api/auth
// ─────────────────────────────────────────────────────────────

const express = require('express');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Nodemailer transporter ────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── In-memory OTP store ───────────────────────────────────────
// Map: email → { code, expiresAt, name, phone, password, line1, line2, city, state, postal, country }
const pending = new Map();

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of pending.entries()) {
    if (entry.expiresAt < now) pending.delete(email);
  }
}, 10 * 60 * 1000);

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─────────────────────────────────────────────────────────────
// POST /api/auth/send-otp
// Body: { email, password, name, phone?, line1?, line2?, city?, state?, postal?, country? }
// Validates inputs, checks email availability, stores pending
// registration, and emails a 6-digit code.
// ─────────────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  const {
    email, password, name,
    phone = '',
    line1 = '', line2 = '', city = '', state = '', postal = '', country = 'US',
  } = req.body;

  // ── Input validation ──
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  // ── Check SMTP is configured ──
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(500).json({ error: 'Email service is not configured on the server.' });
  }

  try {
    // ── Check if email is already registered ──
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const alreadyExists = (existing?.users || []).some(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );
    if (alreadyExists) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // ── Generate and store OTP ──
    const code = generateCode();
    pending.set(email.trim().toLowerCase(), {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
      name: name.trim(),
      phone: phone.trim(),
      password,
      line1: line1.trim(),
      line2: line2.trim(),
      city: city.trim(),
      state: state.trim(),
      postal: postal.trim(),
      country: country.trim() || 'US',
    });

    // ── Send email ──
    const storeName = process.env.STORE_NAME || 'PrintShop';
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"${storeName}" <${process.env.SMTP_USER}>`,
      to: email.trim(),
      subject: `Your ${storeName} verification code`,
      text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, you can ignore this email.`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1e293b">Verify your email</h2>
          <p style="color:#475569">Enter this code to complete your ${storeName} account registration:</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#4f46e5;padding:24px 0">
            ${code}
          </div>
          <p style="color:#94a3b8;font-size:13px">This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/auth/send-otp]', err);
    // If the error is from nodemailer, give a useful message
    if (err.code && err.code.startsWith('EAUTH')) {
      return res.status(500).json({ error: 'Email authentication failed. Check SMTP credentials.' });
    }
    return res.status(500).json({ error: 'Could not send verification email. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/verify-and-register
// Body: { email, code }
// Verifies the OTP, creates the Supabase user + profile.
// ─────────────────────────────────────────────────────────────
router.post('/verify-and-register', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  const key = email.trim().toLowerCase();
  const entry = pending.get(key);

  if (!entry) {
    return res.status(400).json({ error: 'No pending registration for this email. Please start over.' });
  }
  if (Date.now() > entry.expiresAt) {
    pending.delete(key);
    return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
  }
  if (entry.code !== code.trim()) {
    return res.status(400).json({ error: 'Incorrect verification code.' });
  }

  try {
    // ── Create Supabase auth user ──
    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: key,
      password: entry.password,
      email_confirm: true,
    });

    if (createErr) {
      if (createErr.message?.toLowerCase().includes('already')) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      return res.status(400).json({ error: createErr.message });
    }

    const userId = userData.user.id;

    // ── Create user profile ──
    await supabaseAdmin.from('user_profiles').upsert({
      id: userId,
      full_name: entry.name,
      phone: entry.phone || null,
      default_shipping_line1: entry.line1 || null,
      default_shipping_line2: entry.line2 || null,
      default_shipping_city: entry.city || null,
      default_shipping_state: entry.state || null,
      default_shipping_postal_code: entry.postal || null,
      default_shipping_country: entry.country || 'US',
    });

    // ── Clean up pending entry ──
    pending.delete(key);

    return res.status(201).json({ ok: true, email: key });
  } catch (err) {
    console.error('[POST /api/auth/verify-and-register]', err);
    return res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
});

module.exports = router;
