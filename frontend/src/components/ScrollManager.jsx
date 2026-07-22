import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Keyed by React Router's per-entry location.key, which stays stable for
// a given history entry across back/forward navigation — this is what
// lets us tell "the Shop page I'm going back to" apart from "the Shop
// page I'm about to push a new entry for".
const scrollPositions = new Map();

export default function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType(); // "PUSH" | "POP" | "REPLACE"

  // Let us drive scroll restoration ourselves — otherwise the browser's
  // own (unreliable, timing-sensitive) restoration fights with this.
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // Continuously record scroll position against the CURRENT location's
  // key while the user scrolls, rather than trying to capture it exactly
  // at the moment of navigating away (which runs into React effect
  // ordering issues — by then the new page may already be scrolled).
  useEffect(() => {
    const key = location.key;
    const onScroll = () => scrollPositions.set(key, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.key]);

  // On PUSH/REPLACE (clicking a link, e.g. into a product page): scroll
  // to top, matching normal multi-page-site behavior. On POP (browser
  // back/forward): restore exactly where the user was on that page.
  useLayoutEffect(() => {
    if (navigationType === "POP") {
      const saved = scrollPositions.get(location.key);
      window.scrollTo(0, saved ?? 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.key, navigationType]);

  return null;
}
