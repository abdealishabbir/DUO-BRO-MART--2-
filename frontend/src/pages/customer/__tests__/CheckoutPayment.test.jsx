import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils.jsx";
import CheckoutPayment from "../CheckoutPayment.jsx";
import { useCart } from "../../../cart/CartContext.jsx";
import { useCheckout } from "../../../cart/CheckoutContext.jsx";
import { api } from "../../../lib/api.js";

vi.mock("../../../lib/api.js", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const testProduct = { id: 5, name: "Woven Basket", price: 1200 };
const testAddress = {
  full_name: "Ayesha Khan",
  phone_number: "03001234567",
  email: "ayesha@example.com",
  province: "sindh",
  city: "Karachi",
  address_line: "House 12, Street 4",
  area_type: "urban",
};

/**
 * CheckoutPayment redirects away (to /cart or /checkout/shipping) if it
 * mounts with an empty cart or no address — real behavior a customer
 * would hit by navigating straight to /checkout/payment. To test the
 * actual "place order" submission, this harness seeds cart + address
 * via the same providers first (via a real user click, batched in one
 * React update) and only mounts CheckoutPayment once that's in place —
 * it does not touch CheckoutContext/CartContext's real logic at all.
 */
function CheckoutPaymentHarness() {
  const cart = useCart();
  const checkout = useCheckout();
  const [ready, setReady] = useState(false);

  if (!ready) {
    return (
      <button
        onClick={() => {
          cart.addItem(testProduct, 1);
          checkout.setAddress(testAddress);
          setReady(true);
        }}
      >
        prime checkout
      </button>
    );
  }

  return <CheckoutPayment />;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  api.get.mockImplementation((path) => {
    if (path.startsWith("/account/me/")) return Promise.reject({ status: 401 });
    if (path.startsWith("/settings/public/")) {
      return Promise.resolve({ cod_enabled: true, card_enabled: true, easypaisa_enabled: true, jazzcash_enabled: true });
    }
    return Promise.reject(new Error(`Unmocked GET ${path}`));
  });
});

describe("CheckoutPayment — place order", () => {
  it("places a COD order with the seeded cart/address and navigates to confirmation on success", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ id: 1, order_code: "DBM-1234-5678" });

    renderWithProviders(<CheckoutPaymentHarness />, { route: "/checkout/payment", path: "/checkout/payment" });
    await user.click(screen.getByRole("button", { name: /prime checkout/i }));

    await screen.findByRole("heading", { name: /payment details/i });
    await user.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [path, body] = api.post.mock.calls[0];
    expect(path).toBe("/orders/");
    expect(body.payment_method).toBe("cod"); // COD is the default per PRD §5.4
    expect(body.items).toEqual([{ product: 5, quantity: 1 }]);
    expect(body.shipping_full_name).toBe("Ayesha Khan");
  });

  it("clears the cart after a successful order so the customer doesn't see stale items on the confirmation/next visit", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ id: 1, order_code: "DBM-1234-5678" });

    renderWithProviders(<CheckoutPaymentHarness />, { route: "/checkout/payment", path: "/checkout/payment" });
    await user.click(screen.getByRole("button", { name: /prime checkout/i }));
    await screen.findByRole("heading", { name: /payment details/i });
    await user.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem("dbm_cart_v2") || "[]");
      expect(stored).toEqual([]);
    });
  });

  it("shows the backend's error and does NOT clear the cart when order placement fails (e.g. stock changed mid-checkout)", async () => {
    const user = userEvent.setup();
    const stockError = Object.assign(new Error("Request failed"), {
      data: { detail: "Woven Basket just went out of stock." },
    });
    api.post.mockRejectedValue(stockError);

    renderWithProviders(<CheckoutPaymentHarness />, { route: "/checkout/payment", path: "/checkout/payment" });
    await user.click(screen.getByRole("button", { name: /prime checkout/i }));
    await screen.findByRole("heading", { name: /payment details/i });
    await user.click(screen.getByRole("button", { name: /place order/i }));

    expect(await screen.findByText("Woven Basket just went out of stock.")).toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem("dbm_cart_v2") || "[]");
    expect(stored).toHaveLength(1); // cart still has the item — nothing was lost on failure
  });

  it("switches to wallet payment and sends the selected wallet provider", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ id: 1 });

    renderWithProviders(<CheckoutPaymentHarness />, { route: "/checkout/payment", path: "/checkout/payment" });
    await user.click(screen.getByRole("button", { name: /prime checkout/i }));
    await screen.findByRole("heading", { name: /payment details/i });

    await user.click(screen.getByRole("button", { name: /mobile wallet/i }));
    await user.click(screen.getByRole("button", { name: "Easypaisa" }));
    await user.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const body = api.post.mock.calls[0][1];
    expect(body.payment_method).toBe("wallet");
    expect(body.wallet_provider).toBe("Easypaisa");
  });
});
