import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Zap, Store, ChevronLeft, ChevronRight, Star, ZoomIn, X } from "lucide-react";
import { api } from "../../lib/api.js";
import { useCart } from "../../cart/CartContext.jsx";
import { formatPKR } from "../../lib/currency.js";
import { useInventorySocket } from "../../lib/useInventorySocket.js";
import WishlistButton from "../../components/WishlistButton.jsx";
import Meta from "../../components/Meta.jsx";
import ImageWithFallback from "../../components/ImageWithFallback.jsx";
import Button, { buttonClasses } from "../../components/Button.jsx";
import Card from "../../components/Card.jsx";
import { Skeleton, SkeletonText } from "../../components/Skeleton.jsx";
import { recordProductView, getRecentlyViewed } from "../../lib/recentlyViewed.js";

function ProductDetailSkeleton() {
  return (
    <section className="mx-auto grid max-w-7xl gap-8 px-4 py-6 lg:grid-cols-2 lg:px-8">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-7 w-3/4" />
        <Skeleton className="mt-3 h-4 w-32" />
        <Skeleton className="mt-4 h-9 w-40" />
        <SkeletonText lines={3} className="mt-4" />
        <Skeleton className="mt-5 h-16 w-full rounded-lg" />
        <Skeleton className="mt-4 h-11 w-full rounded-md" />
      </div>
    </section>
  );
}

// Feeds the vendor Analytics traffic-source breakdown (§6.7/Phase 6+). No
// UTM parsing, no session tracking — just a coarse bucket from referrer,
// same spirit as the metric it feeds: directional, not exact.
function detectTrafficSource() {
  const ref = typeof document !== "undefined" ? document.referrer : "";
  if (!ref) return "direct";
  try {
    const host = new URL(ref).hostname.replace("www.", "");
    if (/google|bing|yahoo|duckduckgo/.test(host)) return "search";
    if (/facebook|instagram|twitter|x\.com|tiktok|pinterest|whatsapp/.test(host)) return "social";
    if (host === window.location.hostname) return "direct";
    return "other";
  } catch {
    return "direct";
  }
}

/**
 * Full-screen image viewer, opened by tapping/clicking the main product
 * photo. Not built on the shared Modal component — Modal is a small
 * centered white card (right for confirmations and forms, wrong shape
 * for an edge-to-edge photo viewer) — but replicates its accessibility
 * pattern: focus moves in on open and back to the trigger on close,
 * background scroll locks, Escape closes, and arrow keys navigate
 * between images.
 */
function ImageLightbox({ images, active, setActive, name, onClose }) {
  const closeButtonRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setActive((i) => (i - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setActive((i) => (i + 1) % images.length);
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  return (
    // Click-outside-to-close is a convenience shortcut, not the only way to
    // close this viewer — Escape and the Close button are the accessible,
    // keyboard-operable paths.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${name} — image ${active + 1} of ${images.length}`}
      onClick={onClose}
    >
      <button
        ref={closeButtonRef}
        onClick={onClose}
        aria-label="Close image viewer"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-6 w-6" />
      </button>

      {/* stopPropagation keeps a click on the image itself from bubbling to
          the backdrop and closing the viewer. eager: it's already the
          on-screen focus the instant this viewer opens, so lazy-loading
          would only add a delay with no bandwidth benefit. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <ImageWithFallback
        src={images[active]}
        alt={`${name} — full size`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-lg object-contain"
        eager
      />

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActive((i) => (i - 1 + images.length) % images.length);
            }}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-4"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActive((i) => (i + 1) % images.length);
            }}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-4"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
            {active + 1} / {images.length}
          </p>
        </>
      )}
    </div>
  );
}

function ImageCarousel({ images, name }) {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  const shown = images.length ? images : [null]; // ImageWithFallback shows its own local placeholder for a null src — no third-party dependency

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          onClick={() => shown[active] && setLightboxOpen(true)}
          className="group relative block w-full cursor-zoom-in"
          aria-label="View full size image"
        >
          <ImageWithFallback src={shown[active]} alt={name} className="aspect-square w-full rounded-lg object-cover" eager />
          {shown[active] && (
            <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              <ZoomIn className="h-3.5 w-3.5" /> Zoom
            </span>
          )}
        </button>
        {shown.length > 1 && (
          <>
            <button
              onClick={() => setActive((i) => (i - 1 + shown.length) % shown.length)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow hover:bg-surface"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActive((i) => (i + 1) % shown.length)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow hover:bg-surface"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        {shown.map((img, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 ${i === active ? "border-brand" : "border-transparent"}`}
          >
            <ImageWithFallback src={img} alt="" className="h-full w-full object-cover" iconClassName="h-6 w-6" />
          </button>
        ))}
      </div>

      {lightboxOpen && shown[active] && (
        <ImageLightbox images={shown} active={active} setActive={setActive} name={name} onClose={closeLightbox} />
      )}
    </div>
  );
}

function QuantityStepper({ quantity, setQuantity, max }) {
  return (
    <div className="flex items-center rounded-md border border-gray-300">
      <button
        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
        aria-label="Decrease quantity"
        className="p-2.5 text-gray-600 hover:text-brand disabled:opacity-40"
        disabled={quantity <= 1}
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        min={1}
        max={max}
        value={quantity}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v >= 1 && v <= max) setQuantity(v);
        }}
        className="w-14 border-x border-gray-300 py-2.5 text-center text-base focus:outline-none"
      />
      <button
        onClick={() => setQuantity((q) => Math.min(max, q + 1))}
        aria-label="Increase quantity"
        className="p-2.5 text-gray-600 hover:text-brand disabled:opacity-40"
        disabled={quantity >= max}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function RelatedProducts({ products }) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <h2 className="mb-4 text-xl font-bold text-gray-900">You may also like</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {products.map((p) => (
          <Card key={p.id} to={`/product/${p.slug}`} hover padding="sm">
            <ImageWithFallback src={p.images[0]} alt={p.name} className="h-32 w-full rounded-md object-cover" />
            <p className="mt-2 line-clamp-2 text-base font-medium text-gray-900">{p.name}</p>
            <p className="mt-1 text-base font-bold text-gray-900">{formatPKR(p.price)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function RecentlyViewedStrip({ products }) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-10 lg:px-8">
      <h2 className="mb-4 text-xl font-bold text-gray-900">Recently viewed</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        {products.map((p) => (
          <Card key={p.id} to={`/product/${p.slug}`} hover padding="sm">
            <ImageWithFallback src={p.image} alt={p.name} className="h-32 w-full rounded-md object-cover" />
            <p className="mt-2 line-clamp-2 text-base font-medium text-gray-900">{p.name}</p>
            <p className="mt-1 text-base font-bold text-gray-900">{formatPKR(p.price)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);

  useInventorySocket((update) => {
    setProduct((current) => {
      if (!current || current.id !== update.product_id) return current;
      return { ...current, stock_quantity: update.stock_quantity, is_low_stock: update.is_low_stock };
    });
  });
  const [related, setRelated] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setProduct(null);
    setNotFound(false);
    setQuantity(1);
    api
      .get(`/products/${slug}/?src=${detectTrafficSource()}`)
      .then((data) => {
        setProduct(data);
        return api.get(`/products/?category=${data.category_slug}`);
      })
      .then((data) => {
        const pool = data.results ?? data;
        setRelated(pool.filter((p) => p.slug !== slug).slice(0, 4));
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  // Record this view (and load the strip to show, excluding this product
  // itself) only once we actually have product data — not on the earlier
  // `setProduct(null)` reset above, which would try to record a null view.
  useEffect(() => {
    if (!product) return;
    recordProductView(product);
    setRecentlyViewed(getRecentlyViewed(product.id));
    // Only re-run when the product being viewed changes, not on every
    // in-place stock/quantity update pushed by useInventorySocket (which
    // creates a new `product` object reference without changing its id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  if (notFound) return <Navigate to="/shop" replace />;
  if (!product) return <ProductDetailSkeleton />;

  const handleAddToCart = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const handleBuyNow = () => {
    addItem(product, quantity);
  };

  const pageUrl = `${window.location.origin}/product/${product.slug}`;

  return (
    <div>
      <Meta title={product.name} description={product.description} url={pageUrl} image={product.images?.[0]} />
      <div className="mx-auto max-w-7xl px-4 pt-4 text-sm text-gray-500 lg:px-8">
        <Link to="/" className="hover:text-brand">Home</Link> <span className="mx-1">/</span>
        <Link to="/shop" className="hover:text-brand">Shop</Link> <span className="mx-1">/</span>
        <span className="text-gray-900">{product.name}</span>
      </div>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-6 lg:grid-cols-2 lg:px-8">
        <ImageCarousel images={product.images} name={product.name} />

        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand">{product.category_name}</p>
              <h1 className="font-display mt-1 text-2xl font-bold text-gray-900">{product.name}</h1>
            </div>
            <WishlistButton product={product} size="h-5 w-5" className="mt-1 shrink-0 border border-gray-200" />
          </div>
          {product.rating_count > 0 ? (
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-600">
              <Star className="h-4 w-4 fill-gold text-gold" /> {product.average_rating}
              <span className="text-gray-400">({product.rating_count} review{product.rating_count !== 1 && "s"})</span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-400">No reviews yet</p>
          )}

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{formatPKR(product.price)}</span>
            {product.original_price && <span className="text-lg text-gray-400 line-through">{formatPKR(product.original_price)}</span>}
          </div>

          <p className="mt-4 text-base leading-relaxed text-gray-600">{product.description}</p>

          <div className="mt-5 rounded-lg border border-gray-200 bg-cream p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Store className="h-4 w-4 text-brand" /> Sold by{" "}
              <Link to={`/store/${product.vendor}`} className="text-brand hover:underline">
                {product.vendor_name}
              </Link>
            </p>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            {product.stock_quantity === 0 ? (
              <span className="text-red-600">Out of stock</span>
            ) : product.is_low_stock ? (
              <span className="text-amber-700">Only {product.stock_quantity} left</span>
            ) : (
              <span className="text-green-700">In stock ({product.stock_quantity} available)</span>
            )}
          </p>

          {product.stock_quantity > 0 && (
            <>
              <div className="mt-4 flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Quantity</span>
                <QuantityStepper quantity={quantity} setQuantity={setQuantity} max={product.stock_quantity} />
              </div>

              <div className="mt-6 flex gap-3">
                <Button onClick={handleAddToCart} variant="secondary" icon={ShoppingCart} className="flex-1">
                  {added ? "Added!" : "Add to Cart"}
                </Button>
                <Link
                  to="/checkout/shipping"
                  onClick={handleBuyNow}
                  className={buttonClasses({ className: "flex-1" })}
                >
                  <Zap className="h-4 w-4" /> Buy Now
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <RelatedProducts products={related} />
      <RecentlyViewedStrip products={recentlyViewed} />
    </div>
  );
}
