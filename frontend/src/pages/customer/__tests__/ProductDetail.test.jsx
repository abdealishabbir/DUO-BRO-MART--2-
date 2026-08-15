import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils.jsx";
import ProductDetail from "../ProductDetail.jsx";
import { api } from "../../../lib/api.js";

vi.mock("../../../lib/api.js", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const mockProduct = {
  id: 42,
  slug: "terracotta-mug",
  name: "Terracotta Mug",
  description: "A handcrafted mug.",
  price: 500,
  original_price: null,
  images: [],
  category_name: "Home & Living",
  category_slug: "home-living",
  vendor: 7,
  vendor_name: "Karachi Crafts",
  stock_quantity: 10,
  is_low_stock: false,
  rating_count: 0,
  average_rating: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  api.get.mockImplementation((path) => {
    if (path.startsWith("/account/me/")) return Promise.reject({ status: 401 });
    if (path.startsWith(`/products/${mockProduct.slug}/`)) return Promise.resolve(mockProduct);
    if (path.startsWith("/products/?category=")) return Promise.resolve({ results: [] });
    return Promise.reject(new Error(`Unmocked GET ${path}`));
  });
});

describe("ProductDetail — add to cart", () => {
  it("adds the product to the cart with the selected quantity when 'Add to Cart' is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDetail />, { route: "/product/terracotta-mug", path: "/product/:slug" });

    // Wait for the product fetch to resolve and the page to render past "Loading..."
    await screen.findByRole("heading", { name: "Terracotta Mug" });

    // Bump quantity to 2 before adding
    await user.click(screen.getByLabelText(/increase quantity/i));

    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    // Cart persists to localStorage synchronously on every change (CartContext)
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem("dbm_cart_v2"));
      expect(stored).toHaveLength(1);
      expect(stored[0].quantity).toBe(2);
      expect(stored[0].product.id).toBe(mockProduct.id);
    });

    // Button gives feedback rather than looking like nothing happened
    expect(await screen.findByRole("button", { name: /added!/i })).toBeInTheDocument();
  });

  it("does not show an Add to Cart button when the product is out of stock", async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith("/account/me/")) return Promise.reject({ status: 401 });
      if (path.startsWith(`/products/${mockProduct.slug}/`)) return Promise.resolve({ ...mockProduct, stock_quantity: 0 });
      if (path.startsWith("/products/?category=")) return Promise.resolve({ results: [] });
      return Promise.reject(new Error(`Unmocked GET ${path}`));
    });

    renderWithProviders(<ProductDetail />, { route: "/product/terracotta-mug", path: "/product/:slug" });

    await screen.findByText(/out of stock/i);
    expect(screen.queryByRole("button", { name: /add to cart/i })).not.toBeInTheDocument();
  });

  it("adding the same product twice merges into a single cart line with combined quantity", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDetail />, { route: "/product/terracotta-mug", path: "/product/:slug" });

    await screen.findByRole("heading", { name: "Terracotta Mug" });
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("dbm_cart_v2"))).toHaveLength(1);
    });

    // Matches whichever label is showing at this instant ("Add to Cart" or
    // the temporary "Added!" confirmation) — same button, same handler.
    await user.click(screen.getByRole("button", { name: /add to cart|added!/i }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem("dbm_cart_v2"));
      expect(stored).toHaveLength(1);
      expect(stored[0].quantity).toBe(2);
    });
  });
});
