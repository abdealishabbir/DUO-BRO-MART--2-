import { useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Star, Minus, Plus, ShoppingCart, Zap, Store, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { getProductBySlug, getRelatedProducts } from "../../data/productsMockData.js";

function formatPrice(n) {
  return `$${Number(n).toFixed(2)}`;
}

function ImageCarousel({ images, name }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="relative">
        <img src={images[active]} alt={name} className="aspect-square w-full rounded-lg object-cover" />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActive((i) => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActive((i) => (i + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        {images.map((img, i) => (
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
            <img src={p.images[0]} alt={p.name} className="h-32 w-full rounded-md object-cover" />
            <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-900">{p.name}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {p.rating}
            </p>
            <p className="mt-1 text-sm font-bold text-gray-900">{formatPrice(p.price)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const product = getProductBySlug(slug);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) return <Navigate to="/shop" replace />;

  const related = getRelatedProducts(product);

  // Cart is real state starting Phase 4 — for now this just gives visible
  // feedback so the flow is testable end to end without a backend cart yet.
  const handleAddToCart = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 pt-4 text-sm text-gray-500 lg:px-8">
        <Link to="/" className="hover:text-brand">Home</Link> <span className="mx-1">/</span>
        <Link to="/shop" className="hover:text-brand">Shop</Link> <span className="mx-1">/</span>
        <span className="text-gray-900">{product.name}</span>
      </div>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-6 lg:grid-cols-2 lg:px-8">
        <ImageCarousel images={product.images} name={product.name} />

        <div>
          <p className="text-sm font-medium text-brand">{product.categoryLabel}</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="mt-2 flex items-center gap-1 text-sm text-gray-500">
            <Star className="h-4 w-4 fill-gold text-gold" /> {product.rating} <span className="text-gray-400">({product.reviewCount} reviews)</span>
          </p>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{formatPrice(product.price)}</span>
            {product.originalPrice && <span className="text-lg text-gray-400 line-through">{formatPrice(product.originalPrice)}</span>}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-gray-600">{product.description}</p>

          <div className="mt-5 rounded-lg border border-gray-200 bg-cream p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Store className="h-4 w-4 text-brand" /> Sold by {product.vendor.name}
            </p>
            <p className="mt-1 flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-gold text-gold" /> {product.vendor.rating} vendor rating</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {product.vendor.location}</span>
            </p>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            {product.stock > 10 ? (
              <span className="text-green-700">In stock ({product.stock} available)</span>
            ) : (
              <span className="text-amber-700">Only {product.stock} left</span>
            )}
          </p>

          <div className="mt-4 flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Quantity</span>
            <QuantityStepper quantity={quantity} setQuantity={setQuantity} max={product.stock} />
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
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              <Zap className="h-4 w-4" /> Buy Now
            </Link>
          </div>
        </div>
      </section>

      <RelatedProducts products={related} />
    </div>
  );
}
