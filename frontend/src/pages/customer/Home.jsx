import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, ChevronLeft, ChevronRight, Zap, ShieldCheck, Truck, RotateCcw, Headphones,
  Laptop, Shirt, Home as HomeIcon, Dumbbell, BookOpen, Sparkles, Gamepad2, Coffee, Star,
} from "lucide-react";
import CountdownTimer from "../../components/CountdownTimer.jsx";
import Meta from "../../components/Meta.jsx";
import ImageWithFallback from "../../components/ImageWithFallback.jsx";
import { api } from "../../lib/api.js";
import { useCart } from "../../cart/CartContext.jsx";
import { heroSlides as fallbackHeroSlides, promoTiles } from "../../data/homeMockData.js";

const CATEGORY_ICONS = { Laptop, Shirt, Home: HomeIcon, Dumbbell, BookOpen, Sparkles, Gamepad2, Coffee };

// Category has no icon field in the real backend model — this maps a
// handful of common category names to a reasonable icon, falling back
// to a generic one for anything else. Not exhaustive by design: it
// only needs to look right for whatever categories admins have
// actually created.
const ICON_BY_NAME_FRAGMENT = [
  [/electronic|laptop|phone|gadget/i, "Laptop"],
  [/fashion|cloth|apparel|wear/i, "Shirt"],
  [/home|living|furniture|kitchen/i, "Home"],
  [/sport|fitness|outdoor|gym/i, "Dumbbell"],
  [/book|stationery/i, "BookOpen"],
  [/beauty|personal care|cosmetic/i, "Sparkles"],
  [/game|gaming|toy/i, "Gamepad2"],
  [/grocery|food|coffee/i, "Coffee"],
];

function iconNameFor(categoryName) {
  const match = ICON_BY_NAME_FRAGMENT.find(([pattern]) => pattern.test(categoryName));
  return match ? match[1] : "Sparkles";
}

function formatPKR(amount) {
  return `Rs. ${amount.toLocaleString("en-PK")}`;
}

// Maps a live vendor Banner (from /banners/public/carousel/) to the shape
// Hero renders. Falls back to the static demo slide when no vendor has a
// live banner yet, so Home never looks broken on a fresh install.
function bannerToSlide(banner) {
  return {
    id: banner.id,
    title: banner.headline,
    subtitle: banner.description,
    ctaLabel: banner.cta_label,
    ctaHref: banner.cta_url,
    image: banner.image,
  };
}

function Hero() {
  const [slides, setSlides] = useState(fallbackHeroSlides);
  const [active, setActive] = useState(0);

  useEffect(() => {
    api
      .get("/banners/public/carousel/")
      .then((banners) => {
        if (banners.length > 0) setSlides(banners.map(bannerToSlide));
      })
      .catch(() => {}); // keep the fallback slide on any error
  }, []);

  // Auto-advance every 6s when there's more than one live banner.
  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setActive((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  const slide = slides[active] ?? slides[0];
  const goPrev = () => setActive((i) => (i - 1 + slides.length) % slides.length);
  const goNext = () => setActive((i) => (i + 1) % slides.length);

  return (
    <section
      className="relative flex min-h-[440px] items-center bg-cover bg-center px-4 sm:min-h-[520px] lg:min-h-[600px] lg:px-8"
      style={{ backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.55), rgba(0,0,0,0.15)), url(${slide.image})` }}
    >
      <div className="mx-auto w-full max-w-7xl py-20">
        <div className="max-w-xl">
          <h1 className="font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">{slide.title}</h1>
          <p className="mt-5 text-lg text-white/90 sm:text-xl">{slide.subtitle}</p>
          <Link
            to={slide.ctaHref}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-base font-semibold text-white hover:bg-brand-dark"
          >
            {slide.ctaLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <button
        onClick={goPrev}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white hover:bg-black/50 sm:left-5"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={goNext}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white hover:bg-black/50 sm:right-5"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-2 w-2 rounded-full ${i === active ? "bg-brand" : "bg-white/60"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PromoTiles() {
  const variantClasses = {
    dark: "bg-ink text-white",
    gold: "bg-gold text-ink",
    brand: "bg-brand text-white",
  };
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {promoTiles.map((tile) => (
          <div key={tile.id} className={`rounded-xl p-6 ${variantClasses[tile.variant]}`}>
            <h3 className="text-lg font-bold">{tile.title}</h3>
            <p className="mt-1 text-sm opacity-90">{tile.subtitle}</p>
            <Link to={tile.href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold hover:underline">
              {tile.cta} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function FlashDeals({ items }) {
  const { addItem } = useCart();
  const [addedSlug, setAddedSlug] = useState(null);

  const handleAdd = (e, item) => {
    e.preventDefault(); // don't trigger the wrapping Link's navigation
    e.stopPropagation();
    addItem(item, 1);
    setAddedSlug(item.slug);
    setTimeout(() => setAddedSlug((s) => (s === item.slug ? null : s)), 1500);
  };

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display flex items-center gap-1.5 text-xl font-bold text-gray-900">
            <Zap className="h-5 w-5 fill-brand text-brand" /> Flash Deals
          </h2>
          <CountdownTimer />
        </div>
        <Link to="/shop?deals=1" className="text-sm font-medium text-brand hover:underline">
          View All Deals
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => {
          const discountPct = item.original_price ? Math.round((1 - item.price / item.original_price) * 100) : 0;
          return (
            <Link key={item.id} to={`/product/${item.slug}`} className="rounded-lg border border-gray-200 bg-white p-3 hover:shadow-md">
              <div className="relative">
                <span className="absolute left-0 top-0 rounded-br-md rounded-tl-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  -{discountPct}%
                </span>
                <ImageWithFallback src={item.images[0]} alt={item.name} className="h-32 w-full rounded-md object-cover" />
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-900">{item.name}</p>
              {item.rating_count > 0 && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                  <Star className="h-3 w-3 fill-gold text-gold" /> {item.average_rating}
                  <span className="text-gray-400">({item.rating_count})</span>
                </p>
              )}
              <p className="mt-1 text-sm">
                <span className="font-bold text-red-600">{formatPKR(item.price)}</span>{" "}
                {item.original_price && <span className="text-xs text-gray-400 line-through">{formatPKR(item.original_price)}</span>}
              </p>
              {item.is_low_stock && (
                <>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full w-4/5 rounded-full bg-red-500" />
                  </div>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">Only {item.stock_quantity} left</p>
                </>
              )}
              <button
                onClick={(e) => handleAdd(e, item)}
                className="mt-2 w-full rounded-md border border-gray-300 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand hover:text-brand"
              >
                {addedSlug === item.slug ? "Added ✓" : "Add to Cart"}
              </button>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function CategoryGrid({ categories }) {
  const containerRef = useRef(null);
  const [itemWidth, setItemWidth] = useState(0);
  const [visibleCount, setVisibleCount] = useState(8);
  const [order, setOrder] = useState(categories);
  const [offsetPx, setOffsetPx] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => setOrder(categories), [categories]);

  // Measure how wide one tile should be (4 per row on mobile, 8 on
  // larger screens, matching the old static grid) so the slide
  // distance is always exactly one tile — recalculated on resize.
  //
  // Also re-runs whenever `categories` goes from empty to populated: this
  // component returns null (see below) while categories haven't loaded
  // yet, so containerRef isn't attached to any DOM node on the very
  // first mount — a mount-only ([]) effect would measure a null ref
  // forever and never retry once the real container finally renders.
  // Measuring on that transition (not just mount) is what actually
  // fixes it; the rAF/timeout retries below only cover the separate
  // "container exists but hasn't been laid out yet" timing issue.
  useEffect(() => {
    function measure() {
      const width = containerRef.current?.offsetWidth ?? 0;
      const count = window.innerWidth >= 640 ? 8 : 4;
      setVisibleCount(count);
      if (width > 0) setItemWidth(width / count);
    }
    measure();
    const raf = requestAnimationFrame(measure);
    const timeout = setTimeout(measure, 300);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally
    // depends on the same condition as the `categories.length === 0`
    // early-return below (not on `order`, which lags a render behind
    // `categories` via its own effect) — this is the exact moment the
    // container goes from not-rendered to rendered.
  }, [categories.length > 0]);

  // Start each cycle with the track shifted one tile-width to the left,
  // hiding a duplicate of the last category just off-screen to the left.
  useEffect(() => {
    if (itemWidth > 0) setOffsetPx(-itemWidth);
  }, [itemWidth]);

  // Every few seconds, slide the whole track right by one tile-width —
  // slow and smooth (~1.8s), not a fast ticker. The last tile drifts
  // off the right edge as the hidden duplicate eases in from the left.
  useEffect(() => {
    if (!itemWidth) return;
    const id = setInterval(() => {
      setAnimating(true);
      setOffsetPx(0);
    }, 4200);
    return () => clearInterval(id);
  }, [itemWidth]);

  // Once the slide finishes, silently rotate the real order (last
  // category moves to the front) and snap the track back to its
  // starting offset with no transition — invisible to the eye, but now
  // ready to repeat. With only a handful of categories today, the one
  // that just exited on the right is exactly the one that re-enters
  // from the left, same as a circular queue; more categories later
  // just means more of them cycle through in sequence before repeating.
  const handleTransitionEnd = () => {
    setOrder((prev) => [prev[prev.length - 1], ...prev.slice(0, -1)]);
    setAnimating(false);
    setOffsetPx(-itemWidth);
  };

  // Always fill the visible row (+ one hidden lead tile), cycling
  // through `order` via modulo — with fewer categories than slots
  // (today) this repeats them to fill the width; with more categories
  // later, this instead shows more of them across the row before any
  // repeat happens.
  const slotsNeeded = visibleCount + 1;
  const startIndex = order.length - 1;
  const trackItems =
    order.length === 0
      ? []
      : Array.from({ length: slotsNeeded }, (_, i) => order[(startIndex + i) % order.length]);

  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <h2 className="font-display mb-4 text-xl font-bold text-gray-900">Shop by Category</h2>
      <div ref={containerRef} className="overflow-hidden">
        <div
          className="flex"
          style={{
            transform: `translateX(${offsetPx}px)`,
            transition: animating ? "transform 1.8s ease-in-out" : "none",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {trackItems.map((cat, i) => {
            const Icon = CATEGORY_ICONS[iconNameFor(cat.name)];
            return (
              <Link
                key={`${cat.slug}-${i}`}
                to={`/shop?category=${cat.slug}`}
                style={{ flex: `0 0 ${itemWidth}px` }}
                className="flex flex-col items-center gap-2 px-1.5 text-center"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-brand transition hover:shadow-md">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-medium text-gray-700">{cat.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TopSelling({ items }) {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [addedSlug, setAddedSlug] = useState(null);

  const handleAdd = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(item, 1);
    setAddedSlug(item.slug);
    setTimeout(() => setAddedSlug((s) => (s === item.slug ? null : s)), 1500);
  };

  const handleBuyNow = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(item, 1);
    navigate("/cart");
  };

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-gray-900">Top Selling Products</h2>
          <p className="text-sm text-gray-500">Loved by our community</p>
        </div>
        <Link to="/shop" className="text-sm font-medium text-brand hover:underline">
          View All
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <Link key={item.id} to={`/product/${item.slug}`} className="rounded-lg border border-gray-200 bg-white p-3 hover:shadow-md">
            <div className="relative">
              {item.is_deal_active && (
                <span className="absolute left-0 top-0 rounded-br-md rounded-tl-md bg-ink px-2 py-0.5 text-xs font-bold text-white">
                  Sale
                </span>
              )}
              <ImageWithFallback src={item.images[0]} alt={item.name} className="h-36 w-full rounded-md object-cover" />
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-900">{item.name}</p>
            {item.rating_count > 0 && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                <Star className="h-3 w-3 fill-gold text-gold" /> {item.average_rating}
                <span className="text-gray-400">({item.rating_count})</span>
              </p>
            )}
            <p className="mt-1 text-sm">
              <span className="font-bold text-gray-900">{formatPKR(item.price)}</span>{" "}
              {item.original_price && (
                <span className="text-xs text-gray-400 line-through">{formatPKR(item.original_price)}</span>
              )}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={(e) => handleAdd(e, item)}
                className="flex-1 rounded-md border border-gray-300 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand hover:text-brand"
              >
                {addedSlug === item.slug ? "Added ✓" : "Add to Cart"}
              </button>
              <button
                onClick={(e) => handleBuyNow(e, item)}
                className="flex-1 rounded-md bg-brand py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
              >
                Buy Now
              </button>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function BestOfStrip({ items }) {
  if (items.length === 0) return null;
  return (
    <section className="bg-ink py-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <h2 className="font-display mb-8 text-center text-2xl font-bold text-white">Best of Duo Bro Mart</h2>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {items.map((item) => (
            <Link key={item.id} to={`/product/${item.slug}`} className="group">
              <ImageWithFallback src={item.images[0]} alt={item.name} className="aspect-square w-full rounded-lg object-cover transition group-hover:opacity-90" />
              <p className="mt-3 text-sm font-medium text-white">{item.name}</p>
              <p className="mt-1 text-sm text-gold">{formatPKR(item.price)}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { icon: ShieldCheck, title: "Secure Payment", desc: "Your transactions are protected and encrypted." },
    { icon: Truck, title: "Fast Delivery", desc: "Quick and reliable shipping across Pakistan." },
    { icon: RotateCcw, title: "Easy Returns", desc: "30-day hassle-free return policy." },
    { icon: Headphones, title: "24/7 Support", desc: "We're here to help anytime, day or night." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-6 text-center">
            <item.icon className="mx-auto h-7 w-7 text-brand" />
            <h3 className="mt-3 text-sm font-bold text-gray-900">{item.title}</h3>
            <p className="mt-1 text-xs text-gray-500">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function NewsletterBanner() {
  return (
    <section className="bg-gold px-4 py-14 text-center">
      <h2 className="font-display text-2xl font-bold text-ink">Get 15% off your first order</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/80">
        Join our newsletter and be the first to know about new arrivals, sales, and exclusive offers.
      </p>
      <form className="mx-auto mt-6 flex max-w-md gap-2" onSubmit={(e) => e.preventDefault()}>
        <input
          type="email"
          required
          placeholder="Enter your email address"
          className="flex-1 rounded-full border-0 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink"
        />
        <button type="submit" className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white hover:bg-black">
          Subscribe
        </button>
      </form>
    </section>
  );
}

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [deals, setDeals] = useState([]);
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    api.get("/products/categories/").then((data) => setCategories(data.results ?? data));
    api.get("/products/?deals=1").then((data) => setDeals((data.results ?? data).slice(0, 6)));
    // No real "units sold" or rating metric exists yet (that's Phase
    // 7/8 analytics/Feedback territory) — Top Selling/Best Of are
    // approximated with the newest catalog additions until then.
    api.get("/products/?sort=newest").then((data) => setCatalog(data.results ?? data));
  }, []);

  return (
    <div>
      <Meta title="Duo Bro Mart — Shop Pakistan's Marketplace" description="Duo Bro Mart is a Pakistani multi-vendor marketplace — shop electronics, fashion, home goods and more with Cash on Delivery and local payment options." url={window.location.origin} />
      <Hero />
      <PromoTiles />
      <FlashDeals items={deals} />
      <CategoryGrid categories={categories} />
      <TopSelling items={catalog.slice(0, 5)} />
      <BestOfStrip items={catalog.slice(5, 9)} />
      <TrustStrip />
      <NewsletterBanner />
    </div>
  );
}
