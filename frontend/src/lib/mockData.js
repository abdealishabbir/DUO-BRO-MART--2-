/**
 * Demo-mode catalog data — used only when VITE_MOCK_MODE=true (see
 * mockApi.js / api.js). Lets the deployed frontend be browsable and
 * searchable with realistic-looking Pakistani-marketplace products before
 * the real Django backend has a public URL to point VITE_API_BASE_URL at.
 *
 * Nothing here touches real user data, real orders, or a real database —
 * it's pure static content plus a fake in-memory/localStorage session, so
 * it's safe to ship in a public deploy and just as safe to delete once the
 * real backend is live (see api.js for the single on/off switch).
 */

const IMG = (seed) => `https://picsum.photos/seed/${seed}/600/600`;

export const MOCK_CATEGORIES = [
  { id: 1, slug: "mobile-accessories", name: "Mobile Accessories" },
  { id: 2, slug: "home-kitchen", name: "Home & Kitchen" },
  { id: 3, slug: "fashion", name: "Fashion" },
  { id: 4, slug: "beauty-personal-care", name: "Beauty & Personal Care" },
  { id: 5, slug: "electronics", name: "Electronics" },
];

export const MOCK_BRANDS = ["Anker", "Philips", "Nivea", "Generic", "Al-Karam", "Sonex", "Xiaomi"];

const V = (id, name) => ({ id, name });
const VENDORS = [V(101, "Lahore Gadget Hub"), V(102, "Karachi Home Essentials"), V(103, "Faisalabad Fashion House"), V(104, "Islamabad Beauty Bazaar")];

function product({ id, name, category, brand, vendor, price, original, rating, ratingCount, deal, lowStock, stock, desc }) {
  const cat = MOCK_CATEGORIES.find((c) => c.slug === category);
  return {
    id,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    name,
    brand,
    category_slug: cat.slug,
    category_name: cat.name,
    vendor: vendor.id,
    vendor_name: vendor.name,
    price,
    original_price: original ?? null,
    is_deal_active: Boolean(deal),
    average_rating: rating,
    rating_count: ratingCount,
    stock_quantity: stock ?? 40,
    is_low_stock: Boolean(lowStock),
    images: [IMG(id), IMG(id + 1000)],
    description: desc,
  };
}

export const MOCK_PRODUCTS = [
  product({ id: 1, name: "20W Fast Charger Adapter", category: "mobile-accessories", brand: "Anker", vendor: VENDORS[0], price: 1899, original: 2499, rating: 4.6, ratingCount: 312, deal: true, desc: "Compact 20W USB-C fast charger, compatible with most modern smartphones. Includes 1-year replacement warranty." }),
  product({ id: 2, name: "Braided USB-C Cable 1.5m", category: "mobile-accessories", brand: "Anker", vendor: VENDORS[0], price: 799, rating: 4.4, ratingCount: 198, desc: "Durable braided nylon cable, rated for 10,000+ bend cycles." }),
  product({ id: 3, name: "Wireless Earbuds Pro", category: "mobile-accessories", brand: "Generic", vendor: VENDORS[0], price: 3499, original: 4999, rating: 4.2, ratingCount: 540, deal: true, lowStock: true, stock: 4, desc: "Bluetooth 5.3 earbuds with active noise cancellation and 24-hour battery case." }),
  product({ id: 4, name: "Tempered Glass Screen Protector (2-Pack)", category: "mobile-accessories", brand: "Generic", vendor: VENDORS[0], price: 349, rating: 4.0, ratingCount: 87, desc: "9H hardness tempered glass, easy bubble-free installation kit included." }),
  product({ id: 5, name: "Magnetic Car Phone Mount", category: "mobile-accessories", brand: "Generic", vendor: VENDORS[0], price: 999, rating: 4.3, ratingCount: 156, desc: "Strong magnetic mount for dashboard or air vent, 360° rotation." }),
  product({ id: 6, name: "10000mAh Power Bank", category: "mobile-accessories", brand: "Xiaomi", vendor: VENDORS[0], price: 2799, original: 3299, rating: 4.5, ratingCount: 421, deal: true, desc: "Slim-profile power bank with dual USB output and USB-C fast input." }),

  product({ id: 7, name: "Non-Stick Cooking Pan Set (3-Piece)", category: "home-kitchen", brand: "Sonex", vendor: VENDORS[1], price: 4599, original: 5999, rating: 4.5, ratingCount: 210, deal: true, desc: "Induction-friendly non-stick pan set — fry pan, wok, and sauce pan with heat-resistant handles." }),
  product({ id: 8, name: "Electric Kettle 1.7L", category: "home-kitchen", brand: "Philips", vendor: VENDORS[1], price: 3299, rating: 4.6, ratingCount: 389, desc: "Auto shut-off, boil-dry protection, stainless steel body." }),
  product({ id: 9, name: "6-Piece Knife Set with Block", category: "home-kitchen", brand: "Sonex", vendor: VENDORS[1], price: 2199, rating: 4.1, ratingCount: 94, lowStock: true, stock: 6, desc: "High-carbon stainless steel blades, ergonomic handles, wooden block included." }),
  product({ id: 10, name: "Ceramic Dinner Set (16-Piece)", category: "home-kitchen", brand: "Generic", vendor: VENDORS[1], price: 5499, original: 6999, rating: 4.4, ratingCount: 165, deal: true, desc: "Microwave and dishwasher safe, service for 4." }),
  product({ id: 11, name: "Cotton Bedsheet Set (King, 4-Piece)", category: "home-kitchen", brand: "Al-Karam", vendor: VENDORS[1], price: 2999, rating: 4.3, ratingCount: 143, desc: "100% cotton, breathable, includes 2 pillow covers." }),
  product({ id: 12, name: "Stand Mixer 500W", category: "home-kitchen", brand: "Philips", vendor: VENDORS[1], price: 8999, rating: 4.7, ratingCount: 76, desc: "5-speed stand mixer with dough hook, whisk, and beater attachments." }),

  product({ id: 13, name: "Men's Cotton Kurta Shalwar", category: "fashion", brand: "Al-Karam", vendor: VENDORS[2], price: 2499, original: 3299, rating: 4.3, ratingCount: 267, deal: true, desc: "Premium stitched cotton kurta shalwar, available in multiple sizes." }),
  product({ id: 14, name: "Women's Lawn 3-Piece Suit", category: "fashion", brand: "Al-Karam", vendor: VENDORS[2], price: 3799, rating: 4.5, ratingCount: 412, desc: "Unstitched lawn suit with digital print, shirt/dupatta/trouser." }),
  product({ id: 15, name: "Leather Formal Shoes", category: "fashion", brand: "Generic", vendor: VENDORS[2], price: 3299, original: 4199, rating: 4.2, ratingCount: 98, deal: true, desc: "Genuine leather, cushioned insole, available sizes 39-44." }),
  product({ id: 16, name: "Kids' Denim Jacket", category: "fashion", brand: "Generic", vendor: VENDORS[2], price: 1899, rating: 4.0, ratingCount: 54, lowStock: true, stock: 8, desc: "Warm denim jacket for ages 4-10, machine washable." }),
  product({ id: 17, name: "Embroidered Chiffon Dupatta", category: "fashion", brand: "Al-Karam", vendor: VENDORS[2], price: 1299, rating: 4.4, ratingCount: 132, desc: "Hand-finished embroidery, lightweight chiffon fabric." }),
  product({ id: 18, name: "Men's Leather Belt", category: "fashion", brand: "Generic", vendor: VENDORS[2], price: 899, rating: 4.1, ratingCount: 76, desc: "Genuine leather belt with metal buckle, adjustable sizing." }),

  product({ id: 19, name: "Whitening Face Serum 30ml", category: "beauty-personal-care", brand: "Nivea", vendor: VENDORS[3], price: 1499, original: 1899, rating: 4.3, ratingCount: 289, deal: true, desc: "Vitamin C serum for brightening and even skin tone, all skin types." }),
  product({ id: 20, name: "Men's Grooming Kit (5-in-1)", category: "beauty-personal-care", brand: "Philips", vendor: VENDORS[3], price: 3999, rating: 4.5, ratingCount: 201, desc: "Trimmer, shaver, and nose-trimmer set with charging dock." }),
  product({ id: 21, name: "Herbal Shampoo & Conditioner Set", category: "beauty-personal-care", brand: "Nivea", vendor: VENDORS[3], price: 1199, rating: 4.2, ratingCount: 167, desc: "Sulfate-free formula for damaged and color-treated hair." }),
  product({ id: 22, name: "Matte Lipstick Set (6 Shades)", category: "beauty-personal-care", brand: "Generic", vendor: VENDORS[3], price: 1799, original: 2399, rating: 4.4, ratingCount: 356, deal: true, desc: "Long-lasting matte finish, transfer-proof formula." }),

  product({ id: 23, name: "Smart LED Bulb (WiFi, RGB)", category: "electronics", brand: "Xiaomi", vendor: VENDORS[0], price: 1499, rating: 4.3, ratingCount: 119, desc: "App-controlled, 16 million colors, works with voice assistants." }),
  product({ id: 24, name: "Portable Bluetooth Speaker", category: "electronics", brand: "Xiaomi", vendor: VENDORS[0], price: 2999, original: 3799, rating: 4.6, ratingCount: 445, deal: true, desc: "12-hour battery, IPX7 waterproof, deep bass." }),
];

export function generateOrderCode() {
  const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DBM-${rand()}-${rand()}`;
}
