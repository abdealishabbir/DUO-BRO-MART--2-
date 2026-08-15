import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { CartProvider, useCart } from "../CartContext.jsx";

const productA = { id: 1, name: "Terracotta Mug", price: 500 };
const productB = { id: 2, name: "Woven Basket", price: 1200 };

function wrapper({ children }) {
  return <CartProvider>{children}</CartProvider>;
}

describe("CartContext", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.lines).toEqual([]);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it("adds a new product as a new line", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(productA, 1));

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0]).toEqual({ product: productA, quantity: 1 });
    expect(result.current.itemCount).toBe(1);
    expect(result.current.subtotal).toBe(500);
  });

  it("adding the same product again merges quantity into the existing line, not a duplicate line", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(productA, 1));
    act(() => result.current.addItem(productA, 2));

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(3);
    expect(result.current.itemCount).toBe(3);
    expect(result.current.subtotal).toBe(1500);
  });

  it("tracks multiple distinct products as separate lines and sums subtotal correctly", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(productA, 2)); // 1000
    act(() => result.current.addItem(productB, 1)); // 1200

    expect(result.current.lines).toHaveLength(2);
    expect(result.current.itemCount).toBe(3);
    expect(result.current.subtotal).toBe(2200);
  });

  it("updateQuantity changes the quantity of the matching line only", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(productA, 1));
    act(() => result.current.addItem(productB, 1));
    act(() => result.current.updateQuantity(productA.id, 5));

    const lineA = result.current.lines.find((l) => l.product.id === productA.id);
    const lineB = result.current.lines.find((l) => l.product.id === productB.id);
    expect(lineA.quantity).toBe(5);
    expect(lineB.quantity).toBe(1);
  });

  it("updateQuantity to 0 or below removes the line entirely (not a 0-quantity line)", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(productA, 1));
    act(() => result.current.updateQuantity(productA.id, 0));

    expect(result.current.lines).toHaveLength(0);
  });

  it("removeItem removes only the targeted product", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(productA, 1));
    act(() => result.current.addItem(productB, 1));
    act(() => result.current.removeItem(productA.id));

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].product.id).toBe(productB.id);
  });

  it("clearCart empties all lines", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(productA, 1));
    act(() => result.current.addItem(productB, 1));
    act(() => result.current.clearCart());

    expect(result.current.lines).toEqual([]);
    expect(result.current.subtotal).toBe(0);
  });

  it("persists cart contents to localStorage so a refresh doesn't lose the cart", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(productA, 3));

    const stored = JSON.parse(window.localStorage.getItem("dbm_cart_v2"));
    expect(stored).toEqual([{ product: productA, quantity: 3 }]);
  });

  it("a fresh provider mount picks up whatever was already in localStorage", () => {
    window.localStorage.setItem("dbm_cart_v2", JSON.stringify([{ product: productB, quantity: 4 }]));

    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.lines).toEqual([{ product: productB, quantity: 4 }]);
    expect(result.current.subtotal).toBe(4800);
  });
});
