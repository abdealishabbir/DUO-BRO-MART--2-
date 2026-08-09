/**
 * Demo-mode request handler — see api.js for how this gets wired in
 * (only when VITE_MOCK_MODE=true). Every path api.js would normally
 * fetch() against the real Django backend is pattern-matched here
 * instead and answered from mockData.js + a fake localStorage session.
 *
 * This exists for exactly one reason: letting the deployed frontend be
 * browsable/searchable/"checkout-able" before the real backend has a
 * public URL. It is NOT a replacement for real backend tests, and it's
 * intentionally forgiving (e.g. login accepts any email/password) since
 * its only job is to make the demo feel real, not to be secure.
 */

import { MOCK_CATEGORIES, MOCK_BRANDS, MOCK_PRODUCTS, generateOrderCode } from "./mockData.js";

const SESSION_KEY = "dbm_mock_session";
const ADDRESSES_KEY = "dbm_mock_addresses";
const PAGE_SIZE = 20;

function mockError(status, detail, data) {
  const error = new Error(detail);
  error.status = status;
  error.data = data ?? { detail };
  return error;
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(user) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}

function readAddresses() {
  try {
    const raw = localStorage.getItem(ADDRESSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAddresses(addresses) {
  localStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses));
}

function nameFromEmail(email) {
  const local = (email || "demo").split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function fakeUser(email, role = "customer") {
  return {
    id: 1,
    email: email || "demo@example.com",
    first_name: nameFromEmail(email),
    last_name: "",
    role,
    phone_number: "",
  };
}

// Mirrors Shop.jsx / Home.jsx's actual filter+sort+paginate contract —
// see the frontend query-param names in pages/customer/Shop.jsx.
function filterAndSortProducts(query) {
  let items = [...MOCK_PRODUCTS];

  const categories = query.get("categories");
  if (categories) {
    const set = new Set(categories.split(","));
    items = items.filter((p) => set.has(p.category_slug));
  }
  const category = query.get("category"); // single-category (ProductDetail "related products")
  if (category) items = items.filter((p) => p.category_slug === category);

  const brands = query.get("brands");
  if (brands) {
    const set = new Set(brands.split(","));
    items = items.filter((p) => set.has(p.brand));
  }

  const minPrice = query.get("minPrice");
  if (minPrice) items = items.filter((p) => p.price >= Number(minPrice));
  const maxPrice = query.get("maxPrice");
  if (maxPrice) items = items.filter((p) => p.price <= Number(maxPrice));

  if (query.get("deals") === "1") items = items.filter((p) => p.is_deal_active);

  const minRating = query.get("minRating");
  if (minRating) items = items.filter((p) => p.average_rating >= Number(minRating));

  const search = (query.get("search") || "").trim().toLowerCase();
  if (search) {
    items = items.filter(
      (p) => p.name.toLowerCase().includes(search) || p.brand.toLowerCase().includes(search) || p.category_name.toLowerCase().includes(search)
    );
  }

  const sort = query.get("sort") || "newest";
  if (sort === "price_asc") items.sort((a, b) => a.price - b.price);
  else if (sort === "price_desc") items.sort((a, b) => b.price - a.price);
  else if (sort === "rating") items.sort((a, b) => b.average_rating - a.average_rating);
  else items.sort((a, b) => b.id - a.id); // "newest"

  const count = items.length;
  const page = Number(query.get("page") || "1");
  const start = (page - 1) * PAGE_SIZE;
  const results = items.slice(start, start + PAGE_SIZE);

  return { results, count };
}

async function handle(path, method, body) {
  // Simulate real network latency so loading states are visible, same
  // as they would be against a real backend.
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 250));

  const [rawPath, queryString] = path.split("?");
  const query = new URLSearchParams(queryString || "");

  // ---- Catalog ----
  if (rawPath === "/products/categories/" && method === "GET") {
    return { results: MOCK_CATEGORIES };
  }
  if (rawPath === "/products/brands/" && method === "GET") {
    return MOCK_BRANDS;
  }
  if (rawPath === "/products/" && method === "GET") {
    return filterAndSortProducts(query);
  }
  const productSlugMatch = rawPath.match(/^\/products\/([^/]+)\/$/);
  if (productSlugMatch && method === "GET") {
    const product = MOCK_PRODUCTS.find((p) => p.slug === productSlugMatch[1]);
    if (!product) throw mockError(404, "Product not found.");
    return product;
  }

  // ---- Auth (demo mode: any email/password combination succeeds) ----
  if (rawPath === "/account/me/" && method === "GET") {
    const session = readSession();
    if (!session) throw mockError(401, "Not authenticated.");
    return session;
  }
  if ((rawPath === "/auth/login/" || rawPath === "/auth/vendor/login/" || rawPath === "/auth/admin/login/") && method === "POST") {
    if (!body?.email || !body?.password) throw mockError(400, "Email and password are required.");
    const role = rawPath.includes("vendor") ? "vendor" : rawPath.includes("admin") ? "admin" : "customer";
    const user = fakeUser(body.email, role);
    writeSession(user);
    return { user };
  }
  if (rawPath === "/auth/signup/" && method === "POST") {
    if (!body?.email || !body?.password) throw mockError(400, "Email and password are required.");
    const user = fakeUser(body.email, "customer");
    writeSession(user);
    return { user };
  }
  if (rawPath === "/auth/logout/" && method === "POST") {
    writeSession(null);
    return { detail: "Logged out." };
  }

  // ---- Saved addresses (demo mode: kept in localStorage) ----
  if (rawPath === "/account/addresses/" && method === "GET") {
    return readAddresses();
  }
  if (rawPath === "/account/addresses/" && method === "POST") {
    const addresses = readAddresses();
    const saved = { id: addresses.length + 1, ...body };
    addresses.push(saved);
    writeAddresses(addresses);
    return saved;
  }

  // ---- Checkout ----
  if (rawPath === "/settings/public/" && method === "GET") {
    // Every method enabled — this is a demo, showing every option is more useful than gating them.
    return { cod_enabled: true, card_enabled: true, easypaisa_enabled: true, jazzcash_enabled: true };
  }
  if (rawPath === "/orders/" && method === "POST") {
    if (!body?.items?.length) throw mockError(400, "Your cart is empty.");
    const lineItems = body.items.map((line) => {
      const product = MOCK_PRODUCTS.find((p) => p.id === line.product);
      return {
        id: line.product,
        product_name: product?.name ?? "Item",
        vendor_name: product?.vendor_name ?? "Duo Bro Mart Vendor",
        image: product?.images?.[0] ?? null,
        quantity: line.quantity,
        unit_price: product?.price ?? 0,
      };
    });
    const subtotal = lineItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const shippingFee = body.shipping_is_rural ? 250 : 150;
    const discountAmount = body.coupon_code ? Math.round(subtotal * 0.1) : 0;
    return {
      id: Date.now(),
      order_code: generateOrderCode(),
      created_at: new Date().toISOString(),
      status: "pending",
      payment_method: body.payment_method,
      shipping_full_name: body.shipping_full_name,
      shipping_is_rural: body.shipping_is_rural,
      shipping_landmark: body.shipping_landmark || "",
      estimated_delivery_days: body.shipping_is_rural ? 7 : 3,
      coupon_code: body.coupon_code || "",
      discount_amount: discountAmount,
      subtotal,
      shipping_fee: shippingFee,
      total: subtotal - discountAmount + shippingFee,
      items: lineItems,
    };
  }

  // Unhandled path — fail loudly in dev so a gap in mock coverage is
  // obvious immediately rather than silently rendering broken UI.
  console.warn(`[mock mode] No mock handler for ${method} ${path} — add one in mockApi.js or ignore if this page needs a real backend.`);
  throw mockError(404, "Not available in demo mode.");
}

export const mockApi = {
  request: (path, method, body) => handle(path, method, body),
};
