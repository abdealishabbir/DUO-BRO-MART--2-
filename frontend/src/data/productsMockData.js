/**
 * Shared mock product catalog for Shop, Product Detail, and (eventually)
 * Home's product strips. Real Product/Category/Vendor models don't exist
 * until Phase 5/6 (vendor product management, admin approval) — this is
 * shaped close to what that API will eventually return, so swapping it
 * out later is a data-fetch change, not a UI rewrite.
 */

export const CATEGORIES = [
  { id: "electronics", label: "Electronics" },
  { id: "fashion", label: "Fashion" },
  { id: "home-living", label: "Home & Living" },
  { id: "sports-outdoors", label: "Sports & Outdoors" },
  { id: "beauty", label: "Beauty & Personal Care" },
  { id: "books", label: "Books" },
];

export const BRANDS = ["Aura", "Nexus Tech", "Lumina Home", "Strive", "Zenith", "Oasis Living"];

const img = (id) => `https://images.unsplash.com/${id}?q=80&w=800&auto=format&fit=crop`;

export const PRODUCTS = [
  {
    id: 1, slug: "wireless-noise-cancelling-headphones", name: "Wireless Noise-Cancelling Headphones",
    category: "electronics", categoryLabel: "Electronics", brand: "Aura",
    price: 129.99, originalPrice: 199.99, rating: 4.8, reviewCount: 342, badge: "sale", trending: true,
    images: [img("photo-1618366712010-f4ae9c647dcb"), img("photo-1546435770-a3e426bf472b"), img("photo-1545127398-14699f92334b")],
    description: "Studio-grade active noise cancellation with 40 hours of battery life, plush memory-foam ear cups, and multipoint Bluetooth so you can switch between your phone and laptop instantly.",
    vendor: { id: 101, name: "Aura Audio Co.", rating: 4.7, location: "Karachi, Sindh" },
    stock: 34,
  },
  {
    id: 2, slug: "linen-blend-midi-dress", name: "Linen Blend Midi Dress",
    category: "fashion", categoryLabel: "Fashion", brand: "Oasis Living",
    price: 54.00, originalPrice: 89.00, rating: 4.5, reviewCount: 128, badge: "sale", trending: true,
    images: [img("photo-1595777457583-95e059d581b8"), img("photo-1595777457583-95e059d581b8"), img("photo-1490481651871-ab68de25d43d")],
    description: "A breathable linen-cotton blend midi dress with a self-tie waist belt. Relaxed fit, breast pocket, and mother-of-pearl buttons down the front.",
    vendor: { id: 102, name: "Oasis Living Studio", rating: 4.6, location: "Lahore, Punjab" },
    stock: 58,
  },
  {
    id: 3, slug: "ceramic-pour-over-coffee-set", name: "Ceramic Pour-Over Coffee Set",
    category: "home-living", categoryLabel: "Home & Living", brand: "Lumina Home",
    price: 42.50, originalPrice: null, rating: 4.9, reviewCount: 89, badge: null, trending: true,
    images: [img("photo-1495474472287-4d71bcdd2085"), img("photo-1495474472287-4d71bcdd2085"), img("photo-1495474472287-4d71bcdd2085")],
    description: "Hand-thrown stoneware dripper and matching mug set. Slow, even extraction for a cleaner cup — includes 40 reusable cotton filters.",
    vendor: { id: 103, name: "Lumina Home Goods", rating: 4.8, location: "Islamabad" },
    stock: 21,
  },
  {
    id: 4, slug: "minimalist-everyday-sneakers", name: "Minimalist Everyday Sneakers",
    category: "fashion", categoryLabel: "Fashion", brand: "Strive",
    price: 85.00, originalPrice: 110.00, rating: 4.6, reviewCount: 412, badge: "sale", trending: true,
    images: [img("photo-1549298916-b41d501d3772"), img("photo-1549298916-b41d501d3772"), img("photo-1560769629-975ec94e6a86")],
    description: "Clean, low-profile leather sneakers with a cushioned sole built for all-day wear. Pairs with everything from jeans to tailored trousers.",
    vendor: { id: 104, name: "Strive Footwear", rating: 4.5, location: "Karachi, Sindh" },
    stock: 76,
  },
  {
    id: 5, slug: "modern-brass-table-lamp", name: "Modern Brass Table Lamp",
    category: "home-living", categoryLabel: "Home & Living", brand: "Lumina Home",
    price: 68.00, originalPrice: null, rating: 4.7, reviewCount: 65, badge: null, trending: true,
    images: [img("photo-1507473885765-e6ed057f782c"), img("photo-1507473885765-e6ed057f782c"), img("photo-1524484485831-a92ffc0de03f")],
    description: "Solid brass base with a linen drum shade. Warm, diffused light for a reading nook or bedside table. In-line dimmer switch included.",
    vendor: { id: 103, name: "Lumina Home Goods", rating: 4.8, location: "Islamabad" },
    stock: 40,
  },
  {
    id: 6, slug: "classic-leather-tote-bag", name: "Classic Leather Tote Bag",
    category: "fashion", categoryLabel: "Fashion", brand: "Zenith",
    price: 145.00, originalPrice: 185.00, rating: 4.9, reviewCount: 201, badge: "sale", trending: true,
    images: [img("photo-1591561954557-26941169b49e"), img("photo-1591561954557-26941169b49e"), img("photo-1584917865442-de89df76afd3")],
    description: "Full-grain leather tote that ages beautifully. Structured base, interior zip pocket, and a strap drop long enough for shoulder carry.",
    vendor: { id: 105, name: "Zenith Leather Co.", rating: 4.9, location: "Lahore, Punjab" },
    stock: 15,
  },
  {
    id: 7, slug: "smart-fitness-tracker", name: "Smart Fitness Tracker",
    category: "electronics", categoryLabel: "Electronics", brand: "Nexus Tech",
    price: 38.99, originalPrice: 59.99, rating: 4.3, reviewCount: 154, badge: "sale", trending: false,
    images: [img("photo-1575311373937-99fdc0c50a3b"), img("photo-1575311373937-99fdc0c50a3b"), img("photo-1544117519-31a4b719223d")],
    description: "24/7 heart-rate and sleep tracking, 12 workout modes, and a 10-day battery. Water resistant to 50m.",
    vendor: { id: 106, name: "Nexus Tech", rating: 4.4, location: "Karachi, Sindh" },
    stock: 90,
  },
  {
    id: 8, slug: "cozy-throw-blanket", name: "Cozy Throw Blanket",
    category: "home-living", categoryLabel: "Home & Living", brand: "Lumina Home",
    price: 34.00, originalPrice: null, rating: 4.8, reviewCount: 92, badge: null, trending: false,
    images: [img("photo-1616627561950-9f746e330187"), img("photo-1616627561950-9f746e330187"), img("photo-1600369672099-8cb2b8f5b3f8")],
    description: "Chunky-knit throw in 100% cotton. Machine washable, generously sized for a sofa or armchair.",
    vendor: { id: 103, name: "Lumina Home Goods", rating: 4.8, location: "Islamabad" },
    stock: 47,
  },
  {
    id: 9, slug: "professional-studio-microphone", name: "Professional Studio Microphone",
    category: "electronics", categoryLabel: "Electronics", brand: "Aura",
    price: 110.00, originalPrice: 140.00, rating: 4.6, reviewCount: 45, badge: "sale", trending: false,
    images: [img("photo-1590602847861-f357a9332bbc"), img("photo-1590602847861-f357a9332bbc"), img("photo-1590602847861-f357a9332bbc")],
    description: "Cardioid condenser mic with a built-in pop filter and shock mount. USB-C and XLR outputs.",
    vendor: { id: 101, name: "Aura Audio Co.", rating: 4.7, location: "Karachi, Sindh" },
    stock: 22,
  },
  {
    id: 10, slug: "organic-cotton-t-shirt", name: "Organic Cotton T-Shirt",
    category: "fashion", categoryLabel: "Fashion", brand: "Oasis Living",
    price: 28.00, originalPrice: null, rating: 4.5, reviewCount: 310, badge: null, trending: false,
    images: [img("photo-1602810318383-e386cc2a3ccf"), img("photo-1602810318383-e386cc2a3ccf"), img("photo-1521572163474-6864f9cf17ab")],
    description: "GOTS-certified organic cotton, garment-dyed for a soft, lived-in feel from the first wash.",
    vendor: { id: 102, name: "Oasis Living Studio", rating: 4.6, location: "Lahore, Punjab" },
    stock: 120,
  },
  {
    id: 11, slug: "handcrafted-ceramic-mug", name: "Handcrafted Ceramic Mug",
    category: "home-living", categoryLabel: "Home & Living", brand: "Lumina Home",
    price: 24.00, originalPrice: 30.00, rating: 4.9, reviewCount: 18, badge: "sale", trending: false,
    images: [img("photo-1517705008128-361805f42e86"), img("photo-1517705008128-361805f42e86"), img("photo-1517705008128-361805f42e86")],
    description: "Wheel-thrown stoneware mug with a reactive glaze — no two are exactly alike. Holds 350ml.",
    vendor: { id: 103, name: "Lumina Home Goods", rating: 4.8, location: "Islamabad" },
    stock: 63,
  },
  {
    id: 12, slug: "minimalist-leather-watch", name: "Minimalist Leather Watch",
    category: "fashion", categoryLabel: "Fashion", brand: "Zenith",
    price: 95.00, originalPrice: null, rating: 4.4, reviewCount: 76, badge: null, trending: false,
    images: [img("photo-1524805444758-089113d48a6d"), img("photo-1524805444758-089113d48a6d"), img("photo-1524592094714-0f0654e20314")],
    description: "Slim 38mm case, sapphire crystal, genuine leather strap. Japanese quartz movement, 3-year warranty.",
    vendor: { id: 105, name: "Zenith Leather Co.", rating: 4.9, location: "Lahore, Punjab" },
    stock: 29,
  },
  {
    id: 13, slug: "yoga-mat-premium", name: "Premium Non-Slip Yoga Mat",
    category: "sports-outdoors", categoryLabel: "Sports & Outdoors", brand: "Strive",
    price: 32.00, originalPrice: 45.00, rating: 4.7, reviewCount: 210, badge: "sale", trending: false,
    images: [img("photo-1544367567-0f2fcb009e0b"), img("photo-1544367567-0f2fcb009e0b"), img("photo-1599901860904-17e6ed7083a0")],
    description: "6mm double-sided grip mat with alignment lines, includes carry strap. Free of PVC and phthalates.",
    vendor: { id: 104, name: "Strive Footwear", rating: 4.5, location: "Karachi, Sindh" },
    stock: 55,
  },
  {
    id: 14, slug: "adjustable-dumbbell-set", name: "Adjustable Dumbbell Set",
    category: "sports-outdoors", categoryLabel: "Sports & Outdoors", brand: "Strive",
    price: 120.00, originalPrice: null, rating: 4.6, reviewCount: 88, badge: null, trending: false,
    images: [img("photo-1571019613454-1cb2f99b2d8b"), img("photo-1571019613454-1cb2f99b2d8b"), img("photo-1517963879433-6ad2b056d712")],
    description: "5-25kg adjustable pair with quick dial-change plates. Compact enough for a small home gym.",
    vendor: { id: 104, name: "Strive Footwear", rating: 4.5, location: "Karachi, Sindh" },
    stock: 18,
  },
  {
    id: 15, slug: "vitamin-c-serum", name: "Brightening Vitamin C Serum",
    category: "beauty", categoryLabel: "Beauty & Personal Care", brand: "Oasis Living",
    price: 22.00, originalPrice: 30.00, rating: 4.5, reviewCount: 540, badge: "sale", trending: false,
    images: [img("photo-1620916566398-39f1143ab7be"), img("photo-1620916566398-39f1143ab7be"), img("photo-1556228720-195a672e8a03")],
    description: "15% stabilized vitamin C with ferulic acid and vitamin E. Lightweight, fast-absorbing, fragrance-free.",
    vendor: { id: 102, name: "Oasis Living Studio", rating: 4.6, location: "Lahore, Punjab" },
    stock: 140,
  },
  {
    id: 16, slug: "silk-pillowcase", name: "Mulberry Silk Pillowcase",
    category: "beauty", categoryLabel: "Beauty & Personal Care", brand: "Oasis Living",
    price: 36.00, originalPrice: null, rating: 4.8, reviewCount: 96, badge: null, trending: false,
    images: [img("photo-1584100936595-c0654b55a2e2"), img("photo-1584100936595-c0654b55a2e2"), img("photo-1522771739844-6a9f6d5f14af")],
    description: "22-momme mulberry silk, gentler on skin and hair than cotton. Hidden zip closure, standard size.",
    vendor: { id: 102, name: "Oasis Living Studio", rating: 4.6, location: "Lahore, Punjab" },
    stock: 70,
  },
  {
    id: 17, slug: "atomic-habits-book", name: "Atomic Habits (Paperback)",
    category: "books", categoryLabel: "Books", brand: "Zenith",
    price: 14.00, originalPrice: 18.00, rating: 4.9, reviewCount: 980, badge: "sale", trending: false,
    images: [img("photo-1544947950-fa07a98d237f"), img("photo-1544947950-fa07a98d237f"), img("photo-1512820790803-83ca734da794")],
    description: "James Clear's bestseller on building good habits and breaking bad ones, one small change at a time.",
    vendor: { id: 107, name: "Karachi Book House", rating: 4.8, location: "Karachi, Sindh" },
    stock: 210,
  },
  {
    id: 18, slug: "the-pragmatic-programmer", name: "The Pragmatic Programmer",
    category: "books", categoryLabel: "Books", brand: "Zenith",
    price: 32.00, originalPrice: null, rating: 4.7, reviewCount: 310, badge: null, trending: false,
    images: [img("photo-1519682337058-a94d519337bc"), img("photo-1519682337058-a94d519337bc"), img("photo-1481627834876-b7833e8f5570")],
    description: "The classic guide to becoming a more adaptable, effective software developer. 20th anniversary edition.",
    vendor: { id: 107, name: "Karachi Book House", rating: 4.8, location: "Karachi, Sindh" },
    stock: 85,
  },
  {
    id: 19, slug: "wireless-charging-pad", name: "3-in-1 Wireless Charging Pad",
    category: "electronics", categoryLabel: "Electronics", brand: "Nexus Tech",
    price: 29.99, originalPrice: 44.99, rating: 4.2, reviewCount: 176, badge: "sale", trending: false,
    images: [img("photo-1591290619762-c9d2b1a0b39c"), img("photo-1591290619762-c9d2b1a0b39c"), img("photo-1585338447937-7082f8fc763d")],
    description: "Charges phone, earbuds, and watch simultaneously. 15W fast charging, foldable travel design.",
    vendor: { id: 106, name: "Nexus Tech", rating: 4.4, location: "Karachi, Sindh" },
    stock: 65,
  },
  {
    id: 20, slug: "camping-tent-2-person", name: "2-Person Lightweight Camping Tent",
    category: "sports-outdoors", categoryLabel: "Sports & Outdoors", brand: "Strive",
    price: 89.00, originalPrice: null, rating: 4.5, reviewCount: 58, badge: null, trending: false,
    images: [img("photo-1504280390367-361c6d9f38f4"), img("photo-1504280390367-361c6d9f38f4"), img("photo-1478131143081-80f7f84ca84d")],
    description: "Waterproof 3-season tent, sets up in under 5 minutes. Packs down to the size of a water bottle.",
    vendor: { id: 104, name: "Strive Footwear", rating: 4.5, location: "Karachi, Sindh" },
    stock: 24,
  },
];

export function getProductBySlug(slug) {
  return PRODUCTS.find((p) => p.slug === slug) || null;
}

export function getRelatedProducts(product, limit = 4) {
  return PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, limit);
}

export function getCategoryCounts() {
  return CATEGORIES.map((c) => ({ ...c, count: PRODUCTS.filter((p) => p.category === c.id).length }));
}
