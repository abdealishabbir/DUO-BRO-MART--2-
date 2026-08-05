import React, { createContext, useContext, useState } from "react";

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const [items, setItems] = useState([]);
  const add = (p) => setItems((s) => (s.find((i) => i.id === p.id) ? s : [...s, p]));
  const remove = (id) => setItems((s) => s.filter((i) => i.id !== id));
  return <WishlistContext.Provider value={{ items, add, remove, count: items.length }}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}

export default WishlistContext;
