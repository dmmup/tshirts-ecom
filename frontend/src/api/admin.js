// src/api/admin.js
// ─────────────────────────────────────────────────────────────
// Admin API helpers
// All authenticated routes send Authorization: Bearer <token>
// ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return sessionStorage.getItem('admin_token');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

// Throws an object { status, message } on non-ok responses
async function handleResponse(res) {
  if (res.ok) return res.json();
  const err = await res.json().catch(() => ({}));
  const error = new Error(err.error || 'Request failed');
  error.status = res.status;
  throw error;
}

// ── POST /api/admin/verify ────────────────────────────────────
export async function verifyAdmin(secret) {
  const res = await fetch(`${API_BASE}/admin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret }),
  });
  return handleResponse(res); // { ok: true }
}

// ── GET /api/admin/orders ─────────────────────────────────────
export async function fetchAdminOrders({ status, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (status) params.set('status', status);
  const res = await fetch(`${API_BASE}/admin/orders?${params}`, {
    headers: authHeaders(),
  });
  return handleResponse(res); // { stats, orders, total }
}

// ── GET /api/admin/orders/:id ─────────────────────────────────
export async function fetchAdminOrder(id) {
  const res = await fetch(`${API_BASE}/admin/orders/${id}`, {
    headers: authHeaders(),
  });
  return handleResponse(res); // { order, items }
}

// ── PATCH /api/admin/orders/:id/status ───────────────────────
export async function updateOrderStatus(id, status) {
  const res = await fetch(`${API_BASE}/admin/orders/${id}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  return handleResponse(res); // { success, order }
}

// ═════════════════════════════════════════════════════════════
// Product management
// ═════════════════════════════════════════════════════════════

// ── GET /api/admin/products ───────────────────────────────────
export async function fetchAdminProducts() {
  const res = await fetch(`${API_BASE}/admin/products`, { headers: authHeaders() });
  return handleResponse(res);
}

// ── GET /api/admin/products/:id ──────────────────────────────
export async function fetchAdminProduct(id) {
  const res = await fetch(`${API_BASE}/admin/products/${id}`, { headers: authHeaders() });
  return handleResponse(res); // { product, variants, images }
}

// ── POST /api/admin/products ─────────────────────────────────
export async function createProduct(data) {
  const res = await fetch(`${API_BASE}/admin/products`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// ── PATCH /api/admin/products/:id ────────────────────────────
export async function updateProduct(id, data) {
  const res = await fetch(`${API_BASE}/admin/products/${id}`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// ── DELETE /api/admin/products/:id ───────────────────────────
export async function deleteProduct(id) {
  const res = await fetch(`${API_BASE}/admin/products/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── POST /api/admin/products/:id/variants/bulk ───────────────
export async function bulkCreateVariants(productId, data) {
  const res = await fetch(`${API_BASE}/admin/products/${productId}/variants/bulk`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(res); // { inserted, variants }
}

// ── PATCH /api/admin/products/:id/variants/:variantId ────────
// stock: null (unlimited) | 0 (OOS) | positive integer
export async function updateVariantStock(productId, variantId, stock) {
  const res = await fetch(`${API_BASE}/admin/products/${productId}/variants/${variantId}`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ stock }),
  });
  return handleResponse(res);
}

// ── DELETE /api/admin/products/:id/variants/:variantId ───────
export async function deleteVariant(productId, variantId) {
  const res = await fetch(`${API_BASE}/admin/products/${productId}/variants/${variantId}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── POST /api/admin/products/:id/images ──────────────────────
export async function addProductImage(productId, data) {
  const res = await fetch(`${API_BASE}/admin/products/${productId}/images`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// ── DELETE /api/admin/products/:id/images/:imageId ───────────
export async function deleteProductImage(productId, imageId) {
  const res = await fetch(`${API_BASE}/admin/products/${productId}/images/${imageId}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── POST /api/admin/products/upload/sign ─────────────────────
// Returns { signedUrl, storagePath, publicUrl }
// PUT the file to signedUrl, then call addProductImage with publicUrl.
export async function signProductImageUpload({ productId, filename, contentType }) {
  const res = await fetch(`${API_BASE}/admin/products/upload/sign`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ productId, filename, contentType }),
  });
  return handleResponse(res);
}

// ═════════════════════════════════════════════════════════════
// Category management
// ═════════════════════════════════════════════════════════════

// ── GET /api/admin/categories ─────────────────────────────────
export async function fetchAdminCategories() {
  const res = await fetch(`${API_BASE}/admin/categories`, { headers: authHeaders() });
  return handleResponse(res);
}

// ── POST /api/admin/categories ────────────────────────────────
export async function createCategory(data) {
  const res = await fetch(`${API_BASE}/admin/categories`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// ── PATCH /api/admin/categories/:id ──────────────────────────
export async function updateCategory(id, data) {
  const res = await fetch(`${API_BASE}/admin/categories/${id}`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// ── DELETE /api/admin/categories/:id ─────────────────────────
export async function deleteCategory(id) {
  const res = await fetch(`${API_BASE}/admin/categories/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── POST /api/admin/categories/upload/sign ────────────────────
// Returns { signedUrl, publicUrl }
export async function signCategoryImageUpload({ filename, contentType }) {
  const res = await fetch(`${API_BASE}/admin/categories/upload/sign`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ filename, contentType }),
  });
  return handleResponse(res);
}
