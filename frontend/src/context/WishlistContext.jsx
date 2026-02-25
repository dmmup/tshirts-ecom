// src/context/WishlistContext.jsx
// ─────────────────────────────────────────────────────────────
// Provides wishlist state globally.
// Only works when user is authenticated; no-ops when logged out.
// ─────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchWishlist, addToWishlist, removeFromWishlist } from '../api/products';

const WishlistContext = createContext({
  wishlistIds: new Set(),
  isWished: () => false,
  toggle: () => {},
  loading: false,
});

export function WishlistProvider({ children }) {
  const { user, session } = useAuth();
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [loading, setLoading] = useState(false);

  // Load wishlist whenever user changes
  useEffect(() => {
    if (!user || !session?.access_token) {
      setWishlistIds(new Set());
      return;
    }
    setLoading(true);
    fetchWishlist(session.access_token)
      .then((items) => setWishlistIds(new Set(items.map((i) => i.productId))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, session]);

  const isWished = useCallback((productId) => wishlistIds.has(productId), [wishlistIds]);

  const toggle = useCallback(async (productId) => {
    if (!session?.access_token) return; // silently ignore if not logged in

    const wasWished = wishlistIds.has(productId);

    // Optimistic update
    setWishlistIds((prev) => {
      const next = new Set(prev);
      wasWished ? next.delete(productId) : next.add(productId);
      return next;
    });

    try {
      if (wasWished) {
        await removeFromWishlist(productId, session.access_token);
      } else {
        await addToWishlist(productId, session.access_token);
      }
    } catch {
      // Revert on failure
      setWishlistIds((prev) => {
        const next = new Set(prev);
        wasWished ? next.add(productId) : next.delete(productId);
        return next;
      });
    }
  }, [wishlistIds, session]);

  return (
    <WishlistContext.Provider value={{ wishlistIds, isWished, toggle, loading }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
