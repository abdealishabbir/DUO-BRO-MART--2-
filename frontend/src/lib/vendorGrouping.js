/**
 * Groups cart/order line items by vendor for display — a multi-vendor
 * order still has ONE shipping fee and ONE grand total (see
 * DEFAULT_SHIPPING_RATE in currency.js: shipping is a flat per-order
 * rate, not calculated per-vendor), so this only ever affects how the
 * *items* are grouped and subtotaled, never shipping/total math itself.
 *
 * Accepts a normalized line shape so the same function works whether
 * the source is a cart line ({product, quantity}) or a placed order's
 * OrderItem ({vendor_name, unit_price, quantity, ...}) — callers map
 * their own shape into this one first.
 *
 * @param {Array<{key: string|number, vendorName: string, name: string,
 *   image: string|null, quantity: number, unitPrice: number}>} normalizedLines
 * @returns {Array<{vendorName: string, items: Array, vendorSubtotal: number}>}
 */
export function groupLinesByVendor(normalizedLines) {
  const groups = new Map();
  for (const line of normalizedLines) {
    const key = line.vendorName || "Unknown Seller";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }
  return Array.from(groups.entries()).map(([vendorName, items]) => ({
    vendorName,
    items,
    vendorSubtotal: items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
  }));
}
