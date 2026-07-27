import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "dbm_cart_v2";

function loadInitialCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  // items: [{ product: <snapshot from the public catalog API>, quantity }].
  // The product is snapshotted at add-time rather than re-fetched live —
  // there's no "get many products by id" endpoint, and it doesn't matter:
  // the real Order backend (apps/orders) re-validates current price/
  // stock/approval status for every line at checkout time regardless, so
  // a stale cart snapshot can never result in an incorrect charge.
  const [items, setItems] = useState(loadInitialCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, { product, quantity }];
    });
  };

  const updateQuantity = (productId, quantity) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.product.id !== productId)
        : prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
  };

  const removeItem = (productId) => setItems((prev) => prev.filter((i) => i.product.id !== productId));

  const clearCart = () => setItems([]);

  // "lines" kept as the external shape (matches the old mock-data-era
  // API) so Cart/Checkout components don't need to know about the
  // { product, quantity } storage shape directly.
  const lines = items;
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
