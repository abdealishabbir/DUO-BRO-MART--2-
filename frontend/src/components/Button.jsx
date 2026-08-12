import { Loader2 } from "lucide-react";

/**
 * Central button styling — the single source of truth this app didn't
 * have before (every button was a hand-typed className repeated per
 * file, which is how the same "Add to Cart" button ended up at three
 * different sizes across Home/Shop/ProductDetail before this existed).
 *
 * Exported separately from <Button> so a React Router <Link> that needs
 * to *look* like a button (e.g. "Buy Now" navigating to checkout) can
 * use the exact same classes without being forced through a <button>
 * element — `<Link className={buttonClasses({ variant: "primary" })}>`.
 */
export function buttonClasses({ variant = "primary", size = "md", fullWidth = false, className = "" } = {}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

  const variants = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    secondary: "border border-gray-300 text-gray-800 hover:border-brand hover:text-brand",
    danger: "bg-red-600 text-white hover:bg-red-700",
    dangerOutline: "border border-red-200 text-red-600 hover:bg-red-50",
    ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "py-3 px-6 text-base",
    lg: "py-3.5 px-8 text-base",
  };

  return [base, variants[variant] || variants.primary, sizes[size] || sizes.md, fullWidth ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");
}

/**
 * Real button variants (primary/secondary/danger/ghost), consistent
 * sizes, a built-in loading state (spinner + optional swapped label —
 * replaces the "Placing Order..." string-swap pattern that was
 * hand-rolled per call site), and icon support.
 */
export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  loadingText,
  icon: Icon,
  iconPosition = "left",
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  return (
    <button
      disabled={disabled || loading}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText || children}
        </>
      ) : (
        <>
          {Icon && iconPosition === "left" && <Icon className="h-4 w-4" />}
          {children}
          {Icon && iconPosition === "right" && <Icon className="h-4 w-4" />}
        </>
      )}
    </button>
  );
}
