/**
 * Skeleton loading primitives, replacing the plain "Loading..." text that
 * was scattered across 23 page files with placeholder shapes that match
 * the real content's dimensions. All variants share one pulse timing
 * (`animate-pulse`) and fill color (`bg-gray-200`) so loading states feel
 * consistent everywhere, the way VendorStorefront.jsx's local
 * `StorefrontSkeleton` already did before this file existed.
 *
 * These are low-level building blocks, not full-page skeletons. Each page
 * composes its own skeleton from these primitives to match its own layout
 * (see e.g. `OrdersTableSkeleton` in admin/Orders.jsx or
 * `ProductDetailSkeleton` in customer/ProductDetail.jsx), the same way
 * VendorStorefront defines its own local skeleton component.
 */

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

/** A block of placeholder text lines. The last line is shorter by default so it doesn't look like a solid bar. */
export function SkeletonText({ lines = 1, className = "", lineClassName = "h-3", lastLineWidth = "w-2/3" }) {
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`rounded bg-gray-200 ${lineClassName} ${i === lines - 1 && lines > 1 ? lastLineWidth : "w-full"}`} />
      ))}
    </div>
  );
}

/** Matches ProductCard's shape: square image, title, subline, price. Used across Shop.jsx and similar product grids. */
export function SkeletonCard({ className = "" }) {
  return (
    <div className={`animate-pulse overflow-hidden rounded-lg border border-gray-200 bg-surface shadow-sm ${className}`}>
      <div className="aspect-square w-full bg-gray-200" />
      <div className="space-y-2 p-3">
        <div className="h-3.5 w-4/5 rounded bg-gray-200" />
        <div className="h-3 w-1/2 rounded bg-gray-200" />
        <div className="h-4 w-1/3 rounded bg-gray-200" />
      </div>
    </div>
  );
}

/** Stat/KPI card shape used on Dashboard and Analytics pages: a label line and a large value line. Matches the rounded-xl/border-gray-100/shadow-sm treatment every real stat card in the app uses, so nothing visibly "pops" once real data replaces the skeleton. */
export function SkeletonStatCard({ className = "" }) {
  return (
    <div className={`animate-pulse rounded-xl border border-gray-100 bg-surface p-4 shadow-sm ${className}`}>
      <div className="h-3 w-20 rounded bg-gray-200" />
      <div className="mt-3 h-6 w-16 rounded bg-gray-200" />
    </div>
  );
}

/**
 * Table body rows only — for tables whose <thead> already renders (the
 * colSpan-loading-row pattern in admin/Orders, Products, Vendors,
 * Complaints). Drop this straight into an existing <tbody> in place of
 * the old `<tr><td colSpan={n}>Loading...</td></tr>` row.
 */
export function SkeletonTableRows({ columns = 4, rows = 5, cellClassName = "p-2" }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="animate-pulse border-b border-gray-50 last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className={cellClassName}>
              <div className={`h-3 rounded bg-gray-200 ${c === 0 ? "w-28" : "w-16"}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * A full placeholder table — header cells plus body rows — for pages that
 * hide the entire table (including <thead>) behind a single "Loading..."
 * line until data arrives (AuditLog, Coupons, Payouts, Deals, Stock, etc.).
 */
export function SkeletonTable({ columns = 4, rows = 5, cellClassName = "px-4 py-3", className = "" }) {
  return (
    <table className={`w-full text-sm ${className}`}>
      <thead>
        <tr className="animate-pulse border-b border-gray-100">
          {Array.from({ length: columns }).map((_, c) => (
            <th key={c} className={cellClassName}>
              <div className="h-3 w-16 rounded bg-gray-200" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <SkeletonTableRows columns={columns} rows={rows} cellClassName={cellClassName} />
      </tbody>
    </table>
  );
}
