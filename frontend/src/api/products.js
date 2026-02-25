// src/api/products.js
// ─────────────────────────────────────────────────────────────
// API client functions for Product Detail Page
// ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ── Fetch all products (catalog) ─────────────────────────────
export async function fetchProducts() {
  const res = await fetch(`${API_BASE}/products`);
  if (!res.ok) throw new Error('Could not fetch products');
  return res.json(); // array of { id, slug, name, thumbnailUrl, minPrice, colorCount, ... }
}

// ── Fetch product with variants + images ────────────────────
export async function fetchProduct(slug) {
  const res = await fetch(`${API_BASE}/products/${slug}`);
  if (!res.ok) throw new Error(`Product not found: ${slug}`);
  return res.json(); // { product, variants, images }
}

// ── Get signed upload URL ────────────────────────────────────
export async function getSignedUploadUrl({ filename, contentType, userId, anonymousId }) {
  const res = await fetch(`${API_BASE}/products/upload/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType, userId, anonymousId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not get upload URL');
  }
  return res.json(); // { signedUrl, token, storagePath }
}

// ── Upload file directly to Supabase Storage ────────────────
export async function uploadFileToStorage(signedUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(file);
  });
}

// ── Confirm upload + get preview URL ────────────────────────
export async function confirmUpload({ storagePath, filename, fileSize, mimeType, userId, anonymousId }) {
  const res = await fetch(`${API_BASE}/products/upload/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storagePath, filename, fileSize, mimeType, userId, anonymousId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not confirm upload');
  }
  return res.json(); // { success, storagePath, previewUrl, uploadId }
}

// ── Full upload pipeline ─────────────────────────────────────
export async function uploadDesign({ file, userId, anonymousId, onProgress }) {
  // 1. Get signed URL
  const { signedUrl, storagePath } = await getSignedUploadUrl({
    filename: file.name,
    contentType: file.type,
    userId,
    anonymousId,
  });

  // 2. Upload directly to Supabase Storage
  await uploadFileToStorage(signedUrl, file, onProgress);

  // 3. Confirm + get preview URL
  const result = await confirmUpload({
    storagePath,
    filename: file.name,
    fileSize: file.size,
    mimeType: file.type,
    userId,
    anonymousId,
  });

  return result; // { storagePath, previewUrl }
}

// ── Add to cart ──────────────────────────────────────────────
export async function addToCart({ variantId, quantity = 1, config, userId, anonymousId }) {
  const res = await fetch(`${API_BASE}/products/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variantId, quantity, config, userId, anonymousId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not add to cart');
  }
  return res.json(); // { cartItem, cartId, anonymousId }
}

// ── Fetch cart ───────────────────────────────────────────────
export async function fetchCart(anonymousId) {
  const url = `${API_BASE}/cart${anonymousId ? `?anonymousId=${encodeURIComponent(anonymousId)}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not fetch cart');
  }
  return res.json(); // { cartId, items }
}

// ── Update cart item quantity ────────────────────────────────
export async function updateCartItem(itemId, quantity) {
  const res = await fetch(`${API_BASE}/cart/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not update item');
  }
  return res.json(); // { success, item }
}

// ── Remove cart item ─────────────────────────────────────────
export async function removeCartItem(itemId) {
  const res = await fetch(`${API_BASE}/cart/items/${itemId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not remove item');
  }
  return res.json(); // { success }
}

// ── Create Stripe PaymentIntent ──────────────────────────────
export async function createPaymentIntent({ anonymousId, shipping, accessToken }) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  const res = await fetch(`${API_BASE}/checkout/create-payment-intent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ anonymousId, shipping }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not create payment intent');
  }
  return res.json(); // { clientSecret, totalCents, cartId }
}

// ── Fetch related products (same category, excluding current) ─
export async function fetchRelatedProducts(slug) {
  const res = await fetch(`${API_BASE}/products/${encodeURIComponent(slug)}/related`);
  if (!res.ok) return [];
  return res.json(); // [{ id, slug, name, thumbnailUrl, minPrice, colors, base_rating, rating_count }]
}

// ── Fetch all categories ─────────────────────────────────────
export async function fetchCategories() {
  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error('Could not fetch categories');
  return res.json(); // [{ id, slug, name, image_url, sort_order }]
}

// ── Fetch reviews for a product ───────────────────────────────
export async function fetchReviews(slug) {
  const res = await fetch(`${API_BASE}/products/${encodeURIComponent(slug)}/reviews`);
  if (!res.ok) return [];
  return res.json(); // [{ id, rating, comment, reviewer_name, created_at }]
}

// ── Submit a review ───────────────────────────────────────────
export async function submitReview(slug, { rating, comment, reviewerName, anonymousId, accessToken }) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  const res = await fetch(`${API_BASE}/products/${encodeURIComponent(slug)}/reviews`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rating, comment, reviewerName, anonymousId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not submit review');
  }
  return res.json(); // { review, newRating, newCount }
}

// ── Fetch products for a category ───────────────────────────
export async function fetchCategoryProducts(slug) {
  const res = await fetch(`${API_BASE}/categories/${encodeURIComponent(slug)}/products`);
  if (!res.ok) throw new Error(`Could not fetch products for category: ${slug}`);
  return res.json(); // { category, products: [...] }
}
