import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Zap, ShieldCheck, Truck, RotateCcw, Headphones,
  Laptop, Shirt, Home as HomeIcon, Dumbbell, BookOpen, Sparkles, Gamepad2, Coffee, Star,
} from "lucide-react";
import CountdownTimer from "../../components/CountdownTimer.jsx";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import {
  heroSlides as fallbackHeroSlides, promoTiles, flashDeals, categories, topSelling, bestOf,
} from "../../data/homeMockData.js";

const CATEGORY_ICONS = { Laptop, Shirt, Home: HomeIcon, Dumbbell, BookOpen, Sparkles, Gamepad2, Coffee };

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

  return (
    <section
      className="relative flex min-h-[420px] items-center bg-cover bg-center px-4 lg:px-8"
      style={{ backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.55), rgba(0,0,0,0.15)), url(${slide.image})` }}
    >
      <div className="mx-auto w-full max-w-7xl py-16">
        <div className="max-w-xl">
          <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl">{slide.title}</h1>
          <p className="mt-4 text-lg text-white/90">{slide.subtitle}</p>
          <Link
            to={slide.ctaHref}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            {slide.ctaLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
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

function FlashDeals() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-1.5 text-xl font-bold text-gray-900">
            <Zap className="h-5 w-5 fill-brand text-brand" /> Flash Deals
          </h2>
          <CountdownTimer />
        </div>
        <Link to="/shop?deals=1" className="text-sm font-medium text-brand hover:underline">
          View All Deals
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {flashDeals.map((item) => (
          <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="relative">
              <span className="absolute left-0 top-0 rounded-br-md rounded-tl-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                -{item.discountPct}%
              </span>
              <img src={item.image} alt={item.name} className="h-32 w-full rounded-md object-cover" />
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-900">{item.name}</p>
            <p className="mt-1 text-sm">
              <span className="font-bold text-red-600">{formatPKR(item.price)}</span>{" "}
              <span className="text-xs text-gray-400 line-through">{formatPKR(item.originalPrice)}</span>
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-4/5 rounded-full bg-red-500" />
            </div>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">Almost sold out</p>
            <button className="mt-2 w-full rounded-md border border-gray-300 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand hover:text-brand">
              Add to Cart
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CategoryGrid() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <h2 className="mb-4 text-xl font-bold text-gray-900">Shop by Category</h2>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.icon];
          return (
            <Link
              key={cat.id}
              to={`/shop?category=${cat.id}`}
              className="flex flex-col items-center gap-2 rounded-lg bg-white p-4 text-center hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium text-gray-700">{cat.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function TopSelling() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Top Selling Products</h2>
          <p className="text-sm text-gray-500">Loved by our community</p>
        </div>
        <Link to="/shop?sort=best" className="text-sm font-medium text-brand hover:underline">
          View All
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {topSelling.map((item) => (
          <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="relative">
              {item.sale && (
                <span className="absolute left-0 top-0 rounded-br-md rounded-tl-md bg-ink px-2 py-0.5 text-xs font-bold text-white">
                  Sale
                </span>
              )}
              <img src={item.image} alt={item.name} className="h-36 w-full rounded-md object-cover" />
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {item.rating}
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-900">{item.name}</p>
            <p className="mt-1 text-sm">
              <span className="font-bold text-gray-900">{formatPKR(item.price)}</span>{" "}
              {item.originalPrice && (
                <span className="text-xs text-gray-400 line-through">{formatPKR(item.originalPrice)}</span>
              )}
            </p>
            <div className="mt-2 flex gap-2">
              <button className="flex-1 rounded-md border border-gray-300 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand hover:text-brand">
                Add to Cart
              </button>
              <button className="flex-1 rounded-md bg-brand py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">
                Buy Now
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BestOfStrip() {
  return (
    <section className="bg-ink py-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <h2 className="mb-8 text-center text-2xl font-bold text-white">Best of Duo Bro Mart</h2>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {bestOf.map((item) => (
            <div key={item.id}>
              <img src={item.image} alt={item.name} className="aspect-square w-full rounded-lg object-cover" />
              <p className="mt-3 text-sm font-medium text-white">{item.name}</p>
              <p className="mt-1 text-sm text-gold">{formatPKR(item.price)}</p>
            </div>
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
      <h2 className="text-2xl font-bold text-ink">Get 15% off your first order</h2>
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
  return (
    <div>
      <Hero />
      <PromoTiles />
      <FlashDeals />
      <CategoryGrid />
      <TopSelling />
      <BestOfStrip />
      <TrustStrip />
      <NewsletterBanner />
    </div>
  );
}
