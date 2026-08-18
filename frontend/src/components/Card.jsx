import { Link } from "react-router-dom";

/**
 * One canonical card treatment, replacing the several near-duplicate
 * "rounded-lg border border-gray-200 bg-surface p-4" strings that were
 * independently retyped (with small drifting differences — rounded-lg
 * vs rounded-xl, p-3 vs p-4) across product cards, dashboard stat
 * cards, and list items.
 *
 * Elevation: every card sits at shadow-sm at rest (a page of them
 * still reads as flat sheets on the cream background, not a stack of
 * disconnected boxes). Cards that are actually clickable (`hover` or
 * `to`) lift to shadow-lg plus a small upward translate on hover, so
 * interactive cards visibly separate from static ones instead of every
 * card in the app sharing one identical, motionless treatment.
 *
 * Exported separately from <Card> so an element that can't legally be
 * a <div> or <Link> (a <form>, a <p>, a <section>) can still carry the
 * exact same card treatment — `<form className={cardClasses()}>` —
 * mirrors the buttonClasses()/<Button> split in Button.jsx.
 */
export function cardClasses({ hover = false, padding = "md", className = "" } = {}) {
  const paddings = { none: "", sm: "p-3", md: "p-4", lg: "p-6" };
  return [
    "rounded-lg border border-gray-200 bg-surface shadow-sm",
    paddings[padding] ?? paddings.md,
    hover ? "transition duration-200 hover:-translate-y-0.5 hover:shadow-lg" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Renders as a <Link> when `to` is provided (the product-card use
 * case), otherwise a plain <div> — so the same component covers both
 * "clickable card" and "static content card" without a separate name.
 */
export default function Card({ to, hover = false, padding = "md", className = "", children, ...rest }) {
  const classes = cardClasses({ hover: hover || Boolean(to), padding, className });

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
