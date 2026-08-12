import { Link } from "react-router-dom";

/**
 * One canonical card treatment, replacing the several near-duplicate
 * "rounded-lg border border-gray-200 bg-white p-4" strings that were
 * independently retyped (with small drifting differences — rounded-lg
 * vs rounded-xl, p-3 vs p-4) across product cards, dashboard stat
 * cards, and list items.
 *
 * Renders as a <Link> when `to` is provided (the product-card use
 * case), otherwise a plain <div> — so the same component covers both
 * "clickable card" and "static content card" without a separate name.
 */
export default function Card({ to, hover = false, padding = "md", className = "", children, ...rest }) {
  const paddings = { none: "", sm: "p-3", md: "p-4", lg: "p-6" };
  const classes = [
    "rounded-lg border border-gray-200 bg-white",
    paddings[padding] ?? paddings.md,
    hover || to ? "transition hover:shadow-md" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
