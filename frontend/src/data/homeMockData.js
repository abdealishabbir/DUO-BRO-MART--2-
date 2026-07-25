/**
 * Mock data for the Home page (see UI_BUILD_TRACKER.md — real Product/
 * Category models + APIs don't exist until Phase 5/6). Shaped close to
 * what the real API will eventually return so swapping this out later
 * is a small diff, not a rewrite.
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
  { id: "new", title: "New Arrivals", subtitle: "Fresh picks just for you", cta: "Explore", href: "/shop?sort=new", variant: "gold" },
  { id: "vendor", title: "Become a Vendor", subtitle: "Start selling with us today", cta: "Apply Now", href: "/become-a-vendor", variant: "brand" },
];

// flashDeals, topSelling, and bestOf used to be defined here as a
// separate, disconnected mock list — Home.jsx now derives all three
// from the shared PRODUCTS catalog in productsMockData.js instead, so
// clicking through / adding to cart actually works.

// Matches CATEGORIES in productsMockData.js exactly (same ids/labels) so
// clicking a tile always lands on a Shop filter that actually has
// products behind it — this used to have its own separate list (with
// "sports"/"toys"/"kitchen" ids that don't exist in the real catalog),
// which is why some tiles silently showed an empty Shop page.
export const categories = [
  { id: "electronics", label: "Electronics", icon: "Laptop" },
  { id: "fashion", label: "Fashion", icon: "Shirt" },
  { id: "home-living", label: "Home & Living", icon: "Home" },
  { id: "sports-outdoors", label: "Sports & Outdoors", icon: "Dumbbell" },
  { id: "beauty", label: "Beauty & Personal Care", icon: "Sparkles" },
  { id: "books", label: "Books", icon: "BookOpen" },
];


