import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider } from "../../auth/AuthContext.jsx";
import { CheckoutProvider, useCheckout } from "../CheckoutContext.jsx";
import { api } from "../../lib/api.js";

// CheckoutContext.placeOrder is where a checkout could silently create a
// duplicate real order or mis-map an address — this is the actual
// business-logic core behind "checkout submission" (§8.4's idempotency
// guarantee, and the guest-vs-saved-address field mapping), so it's
// tested directly rather than only through button clicks in the UI.
vi.mock("../../lib/api.js", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const guestAddress = {
  full_name: "Ayesha Khan",
  phone_number: "03001234567",
  email: "ayesha@example.com",
  province: "sindh",
  city: "Karachi",
  address_line: "House 12, Street 4",
  area_type: "urban",
  landmark: "",
};

const oneLine = { product: { id: 1, name: "Mug" }, quantity: 2 };

function wrapper({ children }) {
  return (
    <AuthProvider>
      <CheckoutProvider>{children}</CheckoutProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockRejectedValue({ status: 401 }); // AuthProvider's /account/me/ — guest by default
});

describe("CheckoutContext.placeOrder", () => {
  it("builds the order payload from the shipping address and sets billing_same_as_shipping when no separate billing address is passed", async () => {
    api.post.mockResolvedValue({ id: 999, order_code: "DBM-0001" });
    const { result } = renderHook(() => useCheckout(), { wrapper });

    act(() => result.current.setAddress(guestAddress));

    await act(async () => {
      await result.current.placeOrder({ lines: [oneLine], deliveryMethod: "standard", couponCode: "" });
    });

    expect(api.post).toHaveBeenCalledTimes(1);
    const [path, body] = api.post.mock.calls[0];
    expect(path).toBe("/orders/");
    expect(body.shipping_full_name).toBe("Ayesha Khan");
    expect(body.shipping_email).toBe("ayesha@example.com");
    expect(body.shipping_is_rural).toBe(false); // area_type: "urban"
    expect(body.billing_same_as_shipping).toBe(true);
    expect(body.items).toEqual([{ product: 1, quantity: 2 }]);
  });

  it("infers rural from a saved address's landmark when area_type isn't present (accounts.Address has no area_type field)", async () => {
    api.post.mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useCheckout(), { wrapper });

    act(() => result.current.setAddress({ ...guestAddress, area_type: undefined, landmark: "Near the big mosque" }));
    await act(async () => {
      await result.current.placeOrder({ lines: [oneLine] });
    });

    expect(api.post.mock.calls[0][1].shipping_is_rural).toBe(true);
  });

  it("includes separate billing_* fields and flips billing_same_as_shipping to false when a distinct billing address is given", async () => {
    api.post.mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useCheckout(), { wrapper });
    const billing = { full_name: "Bilal Khan", phone_number: "03009999999", province: "punjab", city: "Lahore", address_line: "Flat 3B" };

    act(() => result.current.setAddress(guestAddress));
    await act(async () => {
      await result.current.placeOrder({ lines: [oneLine], billingAddress: billing });
    });

    const body = api.post.mock.calls[0][1];
    expect(body.billing_same_as_shipping).toBe(false);
    expect(body.billing_full_name).toBe("Bilal Khan");
    expect(body.billing_city).toBe("Lahore");
  });

  it("generates one idempotency key and sends the SAME key on a retry after a failed attempt — this is what stops a double-submit from creating two real orders", async () => {
    api.post.mockRejectedValueOnce(new Error("network error")).mockResolvedValueOnce({ id: 1 });
    const { result } = renderHook(() => useCheckout(), { wrapper });
    act(() => result.current.setAddress(guestAddress));

    await act(async () => {
      await expect(result.current.placeOrder({ lines: [oneLine] })).rejects.toThrow();
    });
    await act(async () => {
      await result.current.placeOrder({ lines: [oneLine] });
    });

    const firstKey = api.post.mock.calls[0][1].idempotency_key;
    const secondKey = api.post.mock.calls[1][1].idempotency_key;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });

  it("clears the idempotency key after a successful order, so a genuinely new checkout later gets a fresh key", async () => {
    api.post.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 });
    const { result } = renderHook(() => useCheckout(), { wrapper });
    act(() => result.current.setAddress(guestAddress));

    await act(async () => {
      await result.current.placeOrder({ lines: [oneLine] });
    });
    await act(async () => {
      await result.current.placeOrder({ lines: [oneLine] });
    });

    const firstKey = api.post.mock.calls[0][1].idempotency_key;
    const secondKey = api.post.mock.calls[1][1].idempotency_key;
    expect(secondKey).not.toBe(firstKey);
  });

  it("propagates a failed order-placement so the calling page can show an error instead of silently succeeding", async () => {
    const apiError = Object.assign(new Error("Request failed"), { data: { detail: "That item just went out of stock." } });
    api.post.mockRejectedValue(apiError);
    const { result } = renderHook(() => useCheckout(), { wrapper });
    act(() => result.current.setAddress(guestAddress));

    await waitFor(async () => {
      await expect(result.current.placeOrder({ lines: [oneLine] })).rejects.toMatchObject({
        data: { detail: "That item just went out of stock." },
      });
    });
  });
});
