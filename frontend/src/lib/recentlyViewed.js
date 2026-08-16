/**
 * Tracks a lightweight "recently viewed" product list in localStorage,
 * following the same pattern CartContext already uses for the cart
 * (dbm_*_v1 key, try/catch around access since localStorage can throw
 * in private-browsing/quota-exceeded situations, JSON in/out).
 *
 * Stores small snapshots (id, slug, name, image, price) rather than
 * full product objects — this is just for a "jump back to this" strip,
 * not a source of truth, so it doesn't need live stock/price data. The
 * product detail page re-fetches the real thing when the user clicks
 * through, the same way a stale cart snapshot is never itself what
 * gets charged (see CartContext's comment on the same point).
 */

const STORAGE_KEY = "dbm_recently_viewed_v1";
const MAX_ITEMS = 10;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Private browsing / quota exceeded — recently-viewed is a nice-to-have,
    // fail silently rather than break the page over it.
  }
}

/** Call once a product detail page finishes loading its product. */
export function recordProductView(product) {
  if (!product?.id) return;
  const snapshot = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    image: product.images?.[0] ?? null,
    price: product.price,
  };
  const withoutThisProduct = readAll().filter((p) => p.id !== product.id);
  writeAll([snapshot, ...withoutThisProduct].slice(0, MAX_ITEMS));
}

/** Returns recently viewed products, most recent first, excluding the given id (the product currently being viewed). */
export function getRecentlyViewed(excludeId) {
  return readAll().filter((p) => p.id !== excludeId);
}
