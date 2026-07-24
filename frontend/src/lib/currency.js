// Single source of truth for PKR formatting and Pakistan-specific
// commerce constants (PRD §5.4, §7.8). Import this everywhere a price
// or shipping/threshold value is shown so numbers never drift between
// cart, checkout, vendor, and admin screens.

/**
 * Formats a number as PKR, e.g. formatPKR(5000) -> "Rs. 5,000".
 * Matches the "Rs." display format already used on the Home page and
 * vendor/admin banner pages — kept here as the single shared version
 * so every page renders prices identically.
 */
export function formatPKR(amount) {
  const n = Number(amount) || 0;
  return `Rs. ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

// PRD §7.8: default shipping rate PKR 250 (city-to-city standard);
// free-shipping threshold PKR 5,000 (admin-editable in real Settings,
// this is the default used until that Settings page exists).
export const FREE_SHIPPING_THRESHOLD = 5000;
export const DEFAULT_SHIPPING_RATE = 250;
