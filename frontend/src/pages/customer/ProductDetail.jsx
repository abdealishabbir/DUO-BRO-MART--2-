import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Zap, Store, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { api } from "../../lib/api.js";
import { useCart } from "../../cart/CartContext.jsx";
import { formatPKR } from "../../lib/currency.js";
import { useInventorySocket } from "../../lib/useInventorySocket.js";
import WishlistButton from "../../components/WishlistButton.jsx";
import Meta from "../../components/Meta.jsx";

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

function ImageCarousel({ images, name }) {
  const [active, setActive] = useState(0);
  const shown = images.length ? images : ["https://placehold.co/600x600?text=No+Image"];

  return (
    <div>
      <div className="relative">
        <img src={shown[active]} alt={name} className="aspect-square w-full rounded-lg object-cover" />
        {shown.length > 1 && (
          <>
            <button
              onClick={() => setActive((i) => (i - 1 + shown.length) % shown.length)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActive((i) => (i + 1) % shown.length)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow hover:bg-white"
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
            <img src={img} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
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
        className="w-14 border-x border-gray-300 py-2.5 text-center text-sm focus:outline-none"
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
          <Link key={p.id} to={`/product/${p.slug}`} className="rounded-lg border border-gray-200 bg-white p-3 hover:shadow-md">
            <img src={p.images[0] || "https://placehold.co/300x300?text=No+Image"} alt={p.name} className="h-32 w-full rounded-md object-cover" />
            <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-900">{p.name}</p>
            <p className="mt-1 text-sm font-bold text-gray-900">{formatPKR(p.price)}</p>
          </Link>
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

  if (notFound) return <Navigate to="/shop" replace />;
  if (!product) return <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-gray-500">Loading...</div>;

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
              <h1 className="mt-1 text-2xl font-bold text-gray-900">{product.name}</h1>
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

          <p className="mt-4 text-sm leading-relaxed text-gray-600">{product.description}</p>

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
                <button
                  onClick={handleAddToCart}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-300 py-3 text-sm font-semibold text-gray-800 hover:border-brand hover:text-brand"
                >
                  <ShoppingCart className="h-4 w-4" /> {added ? "Added!" : "Add to Cart"}
                </button>
                <Link
                  to="/checkout/shipping"
                  onClick={handleBuyNow}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  <Zap className="h-4 w-4" /> Buy Now
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <RelatedProducts products={related} />
    </div>
  );
}
