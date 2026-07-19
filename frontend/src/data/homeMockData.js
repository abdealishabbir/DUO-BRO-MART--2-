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

export const flashDeals = [
  { id: 1, name: "Smart Fitness Tracker", price: 3999, originalPrice: 7999, discountPct: 50, image: "https://images.unsplash.com/photo-1575311373937-99fdc0c50a3b?q=80&w=600&auto=format&fit=crop" },
  { id: 2, name: "Minimalist Leather Watch", price: 5500, originalPrice: 9500, discountPct: 42, image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?q=80&w=600&auto=format&fit=crop" },
  { id: 3, name: "Cozy Throw Blanket", price: 1900, originalPrice: 3400, discountPct: 44, image: "https://images.unsplash.com/photo-1616627561950-9f746e330187?q=80&w=600&auto=format&fit=crop" },
  { id: 4, name: "Organic Cotton Kurta", price: 1500, originalPrice: 2800, discountPct: 46, image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=600&auto=format&fit=crop" },
  { id: 5, name: "Handcrafted Ceramic Mug", price: 1500, originalPrice: 3000, discountPct: 50, image: "https://images.unsplash.com/photo-1517705008128-361805f42e86?q=80&w=600&auto=format&fit=crop" },
  { id: 6, name: "Professional Studio Mic", price: 8500, originalPrice: 14000, discountPct: 39, image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=600&auto=format&fit=crop" },
];

export const categories = [
  { id: "electronics", label: "Electronics", icon: "Laptop" },
  { id: "fashion", label: "Fashion", icon: "Shirt" },
  { id: "home-living", label: "Home & Living", icon: "Home" },
  { id: "sports", label: "Sports", icon: "Dumbbell" },
  { id: "books", label: "Books", icon: "BookOpen" },
  { id: "beauty", label: "Beauty", icon: "Sparkles" },
  { id: "toys", label: "Toys", icon: "Gamepad2" },
  { id: "kitchen", label: "Kitchen", icon: "Coffee" },
];

export const topSelling = [
  { id: 1, name: "Wireless Noise-Cancelling Headphones", price: 12999, originalPrice: 19999, rating: 4.8, sale: true, image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?q=80&w=600&auto=format&fit=crop" },
  { id: 2, name: "Linen Blend Midi Dress", price: 5400, originalPrice: 8900, rating: 4.5, sale: true, image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=600&auto=format&fit=crop" },
  { id: 3, name: "Ceramic Pour-Over Coffee Set", price: 4250, originalPrice: null, rating: 4.9, sale: false, image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=600&auto=format&fit=crop" },
  { id: 4, name: "Minimalist Everyday Sneakers", price: 8500, originalPrice: 11000, rating: 4.6, sale: true, image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=600&auto=format&fit=crop" },
  { id: 5, name: "Modern Brass Table Lamp", price: 6800, originalPrice: null, rating: 4.7, sale: false, image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?q=80&w=600&auto=format&fit=crop" },
];

export const bestOf = [
  { id: 1, name: "Wireless Noise-Cancelling Headphones", price: 12999, image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?q=80&w=600&auto=format&fit=crop" },
  { id: 2, name: "Linen Blend Midi Dress", price: 5400, image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=600&auto=format&fit=crop" },
  { id: 3, name: "Ceramic Pour-Over Coffee Set", price: 4250, image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=600&auto=format&fit=crop" },
  { id: 4, name: "Minimalist Everyday Sneakers", price: 8500, image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=600&auto=format&fit=crop" },
];
