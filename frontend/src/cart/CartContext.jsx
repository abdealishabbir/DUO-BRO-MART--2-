import { createContext, useContext, useEffect, useState } from "react";
import { getProductBySlug } from "../data/productsMockData.js";

const CartContext = createContext(null);
const STORAGE_KEY = "dbm_cart_v1";

function loadInitialCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  // items: [{ slug, quantity }] — kept minimal and re-hydrated against
  // the live product catalog on every render, so price/stock changes
  // in the catalog are always reflected rather than going stale.
  const [items, setItems] = useState(loadInitialCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (slug, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.slug === slug);
      if (existing) {
        return prev.map((i) => (i.slug === slug ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, { slug, quantity }];
    });
  };

  const updateQuantity = (slug, quantity) => {
    setItems((prev) =>
      quantity <= 0 ? prev.filter((i) => i.slug !== slug) : prev.map((i) => (i.slug === slug ? { ...i, quantity } : i))
    );
  };

  const removeItem = (slug) => setItems((prev) => prev.filter((i) => i.slug !== slug));

  const clearCart = () => setItems([]);

  // Hydrate against the live catalog; silently drop any line whose
  // product no longer exists (e.g. removed from the mock catalog).
  const lines = items
    .map((i) => {
      const product = getProductBySlug(i.slug);
      return product ? { ...i, product } : null;
    })
    .filter(Boolean);

  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  const value = { lines, itemCount, subtotal, addItem, updateQuantity, removeItem, clearCart };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
