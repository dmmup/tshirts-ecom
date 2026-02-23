// src/api/products.js
// ─────────────────────────────────────────────────────────────
// API client functions for Product Detail Page
// ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

  // 2. Upload directly
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
