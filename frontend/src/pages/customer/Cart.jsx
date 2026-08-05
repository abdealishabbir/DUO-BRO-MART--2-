import Meta from "../../components/Meta.jsx";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "../../cart/CartContext.jsx";
import CheckoutSteps from "../../components/CheckoutSteps.jsx";
import OrderSummarySidebar from "../../components/OrderSummarySidebar.jsx";
import { formatPKR, FREE_SHIPPING_THRESHOLD, DEFAULT_SHIPPING_RATE } from "../../lib/currency.js";

function CartLine({ line, onUpdateQuantity, onRemove }) {
  const { product, quantity } = line;
  const hasDiscount = product?.original_price && product.original_price > product.price;

  return (
    <div className="flex gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <Link to={`/product/${product.slug}`} className="shrink-0">
        <img
          src={product.images?.[0] || "https://placehold.co/200x200?text=No+Image"}
          alt={product.name}
          className="h-24 w-24 rounded-md object-cover"
        />
      </Link>
      <div className="flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link to={`/product/${product.slug}`} className="font-medium text-gray-900 hover:text-brand">
              {product.name}
            </Link>
            <p className="text-xs text-gray-500">{product.category_name} · Sold by {product.vendor_name}</p>
          </div>
          <button onClick={() => onRemove(product.id)} className="text-gray-400 hover:text-red-600" aria-label="Remove item">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center rounded-md border border-gray-300">
            <button
              onClick={() => onUpdateQuantity(product.id, quantity - 1)}
              className="p-1.5 text-gray-600 hover:text-brand"
              aria-label={`Decrease quantity of ${product.name}`}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-8 text-center text-sm">{quantity}</span>
            <button
              onClick={() => onUpdateQuantity(product.id, Math.min(product.stock_quantity, quantity + 1))}
              disabled={quantity >= product.stock_quantity}
              className="p-1.5 text-gray-600 hover:text-brand disabled:opacity-40"
              aria-label={`Increase quantity of ${product.name}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-right">
            {hasDiscount && (
              <p className="text-xs text-gray-400 line-through">{formatPKR(product.original_price * quantity)}</p>
            )}
            <p className="font-semibold text-gray-900">{formatPKR(product.price * quantity)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <ShoppingBag className="mx-auto h-12 w-12 text-gray-300" />
      <h1 className="mt-4 text-xl font-bold text-gray-900">Your cart is empty</h1>
      <p className="mt-2 text-sm text-gray-500">Looks like you haven&apos;t added anything yet.</p>
      <Link to="/shop" className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
        Browse Shop <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function Cart() {
  const { lines, subtotal, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();

  if (!lines || lines.length === 0) return <EmptyCart />;

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_RATE;

  const discount = lines.reduce((sum, l) => {
    const orig = l.product?.original_price;
    return orig && orig > l.product.price ? sum + (orig - l.product.price) * l.quantity : sum;
  }, 0);

  return (
    <>
      <Meta
        title="Cart"
        description="Review items in your Duo Bro Mart cart before checkout."
        url={`${window.location.origin}/cart`}
      />

      <div className="mx-auto max-w-6xl px-4 py-8">
        <CheckoutSteps current={1} />

        <h1 className="mt-6 text-2xl font-bold text-gray-900">
          Your Cart <span className="text-base font-normal text-gray-400">({lines.length} item{lines.length !== 1 && "s"})</span>
        </h1>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {lines.map((line) => (
              <CartLine key={line.product.id} line={line} onUpdateQuantity={updateQuantity} onRemove={removeItem} />
            ))}
          </div>

          <div className="space-y-4">
            <OrderSummarySidebar lines={lines} subtotal={subtotal} shipping={shipping} discount={discount} showCoupon />
            <button
              onClick={() => navigate("/checkout/shipping")}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Proceed to Checkout <ArrowRight className="h-4 w-4" />
            </button>
            <Link to="/shop" className="block text-center text-sm text-gray-500 hover:text-brand">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
