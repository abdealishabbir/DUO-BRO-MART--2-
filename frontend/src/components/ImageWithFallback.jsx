import { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * Drop-in replacement for a plain <img> wherever the src is real,
 * potentially-unreliable content — a vendor's uploaded product photo,
 * shop logo, or promotional banner — rather than a bundled app asset.
 *
 * Two failure modes it actually covers, that a plain <img> (even with the
 * old `src={x || "https://placehold.co/..."}` pattern used in a few
 * places) does NOT:
 *   1. No src at all → shows the placeholder immediately, no request made.
 *   2. A src IS provided but the request fails (dead link, vendor's CDN
 *      hiccups, slow/timed-out load) → the old pattern never catches this,
 *      since the ternary only ever looks at whether `src` was falsy to
 *      begin with. This component's onError handler is what actually
 *      catches case 2, swapping to the same placeholder instead of the
 *      browser's default broken-image icon.
 *
 * Deliberately not used for local blob previews (`URL.createObjectURL`)
 * of a file the user just selected in this session — those can't fail to
 * load the way a remote URL can, so wrapping them here would add nothing.
 *
 * Defaults to native lazy-loading (loading="lazy") — the browser only
 * fetches the image once it's near the viewport, instead of every image
 * on the page (including ones the visitor may never scroll to) competing
 * for bandwidth on first load. Pass `eager` for anything that's already
 * visible without scrolling — the main product photo on ProductDetail is
 * the one clear case in this app — since lazy-loading something already
 * on-screen only delays it for no benefit, and can hurt LCP if it's the
 * page's largest visible element.
 */
export default function ImageWithFallback({ src, alt = "", className = "", iconClassName, eager = false, ...rest }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt || "Image unavailable"}
        className={`flex items-center justify-center bg-gray-100 text-gray-300 ${className}`}
      >
        <ImageOff className={iconClassName || "h-1/3 w-1/3"} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      {...rest}
    />
  );
}
