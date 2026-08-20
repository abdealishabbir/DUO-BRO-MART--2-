/**
 * Formalizes the status-pill convention that already existed
 * independently in several admin/vendor files (amber=pending,
 * blue=processing, green=success, red=danger) as one shared component,
 * plus a `brand` variant for the "Sale" / deal-tag use case on product
 * cards that used a one-off ink/white treatment instead.
 */
const VARIANTS = {
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  neutral: "bg-gray-100 text-gray-600",
  brand: "bg-ink text-white",
  // "shipped" (order pipeline) is a deliberately distinct stage from
  // "processing" (info/blue) — added rather than collapsed into info,
  // which would lose that distinction on both Orders tables that use it.
  indigo: "bg-indigo-100 text-indigo-700",
  // "suspended" (banner promotions) is a deliberately stronger red than
  // ordinary danger/rejected — added rather than collapsed into danger.
  severe: "bg-red-200 text-red-900",
};

export default function Badge({ variant = "neutral", className = "", children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${VARIANTS[variant] || VARIANTS.neutral} ${className}`}>
      {children}
    </span>
  );
}
