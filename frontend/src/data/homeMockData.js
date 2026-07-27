/**
 * Remaining static/decorative Home page content that has no backend
 * model behind it: the hero fallback slide (real banners come from
 * /banners/public/carousel/ — this is only shown when no vendor has a
 * live banner yet) and the three static promo tiles. Categories and
 * products are real now (see apps/products) and are fetched directly
 * in Home.jsx instead of living here.
 */

export const heroSlides = [
  {
    id: 1,
    title: "Discover Your Next Favorite Find",
    subtitle: "Shop handpicked collections from local Pakistani sellers.",
    ctaLabel: "Shop Now",
    ctaHref: "/shop",
    image:
      "https://images.unsplash.com/photo-1555529771-7888783a18d3?q=80&w=1600&auto=format&fit=crop",
  },
];

export const promoTiles = [
  { id: "shipping", title: "Free Shipping", subtitle: "On all orders over Rs. 5,000", cta: "Shop Now", href: "/shop", variant: "dark" },
  { id: "new", title: "New Arrivals", subtitle: "Fresh picks just for you", cta: "Explore", href: "/shop?sort=newest", variant: "gold" },
  { id: "vendor", title: "Become a Vendor", subtitle: "Start selling with us today", cta: "Apply Now", href: "/become-a-vendor", variant: "brand" },
];
