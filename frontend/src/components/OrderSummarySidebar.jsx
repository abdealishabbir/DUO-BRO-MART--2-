import { ShieldCheck } from "lucide-react";

function formatPrice(n) {
  return `$${Number(n).toFixed(2)}`;
}

export default function OrderSummarySidebar({ lines, subtotal, shipping, tax = 0, showCoupon = false }) {
  const total = subtotal + shipping + tax;

  return (
    <div className="h-fit rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="font-bold text-gray-900">Order Summary</h2>

      <div className="mt-4 space-y-3 border-b border-gray-100 pb-4">
        {lines.map((line) => (
          <div key={line.slug ?? line.product?.slug} className="flex items-center gap-3">
            <img
              src={line.product?.images?.[0] ?? line.image}
              alt=""
              className="h-12 w-12 shrink-0 rounded-md object-cover"
            />
            <div className="flex-1 text-sm">
              <p className="font-medium text-gray-900">{line.product?.name ?? line.name}</p>
              <p className="text-xs text-gray-500">
                Qty: {line.quantity} × {formatPrice(line.product?.price ?? line.price)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Shipping</span>
          <span>{shipping === 0 ? <span className="text-green-700">Free</span> : formatPrice(shipping)}</span>
        </div>
        {tax > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Estimated Tax</span>
            <span>{formatPrice(tax)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      {showCoupon && (
        <form className="mt-4 flex gap-2" onSubmit={(e) => e.preventDefault()}>
          <input
            type="text"
            placeholder="COUPON CODE"
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-xs uppercase tracking-wide focus:border-brand focus:outline-none"
          />
          <button type="submit" className="rounded-md bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-black">
            Apply
          </button>
        </form>
      )}

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5 text-green-600" /> Secure Checkout
      </p>
    </div>
  );
}
