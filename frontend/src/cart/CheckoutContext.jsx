import { createContext, useContext, useState } from "react";

const CheckoutContext = createContext(null);
const ORDERS_STORAGE_KEY = "dbm_mock_orders_v1";

function loadOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

function generateOrderId() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DBM-${new Date().getFullYear()}-${rand}`;
}

export function CheckoutProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [deliveryMethod, setDeliveryMethod] = useState("standard");
  const [paymentMethod, setPaymentMethod] = useState("cod");

  /**
   * Creates a mock order record in localStorage and returns it. Real
   * order placement (POST /api/orders/) needs a real Product/Order
   * backend, which doesn't exist until Phase 5/6 — this keeps the
   * checkout flow fully clickable/testable end to end in the meantime,
   * and TrackOrder reads from the same storage.
   */
  const placeOrder = ({ lines, subtotal, shipping, total }) => {
    const order = {
      id: generateOrderId(),
      status: "confirmed",
      placedAt: new Date().toISOString(),
      address,
      paymentMethod,
      items: lines.map((l) => ({
        slug: l.product.slug,
        name: l.product.name,
        image: l.product.images[0],
        price: l.product.price,
        quantity: l.quantity,
      })),
      subtotal,
      shipping,
      total,
      estimatedDeliveryDays: 5,
    };
    saveOrders([order, ...loadOrders()]);
    return order;
  };

  const value = { address, setAddress, deliveryMethod, setDeliveryMethod, paymentMethod, setPaymentMethod, placeOrder };

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error("useCheckout must be used within a CheckoutProvider");
  return ctx;
}

export function getMockOrder(orderId) {
  return loadOrders().find((o) => o.id === orderId) || null;
}

export function getAllMockOrders() {
  return loadOrders();
}
