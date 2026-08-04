import { ShieldCheck } from "lucide-react";
import { formatPKR } from "../lib/currency.js";
import { groupLinesByVendor } from "../lib/vendorGrouping.js";

export default function OrderSummarySidebar({ lines, subtotal, shipping, tax = 0, discount = 0, showCoupon = false }) {
  const total = subtotal - discount + shipping + tax;

  const vendorGroups = groupLinesByVendor(
    lines.map((line) => ({
      key: line.product?.id ?? line.slug ?? line.product?.slug,
      vendorName: line.product?.vendor_name ?? line.vendor_name,
      name: line.product?.name ?? line.name,
      image: line.product?.images?.[0] ?? line.image,
      quantity: line.quantity,
      unitPrice: line.product?.price ?? line.price,
    }))
  );
  const showVendorGroups = vendorGroups.length > 1;

  return (
    <div className="h-fit rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="font-bold text-gray-900">Order Summary</h2>

      <div className="mt-4 space-y-4 border-b border-gray-100 pb-4">
        {vendorGroups.map((group) => (
          <div key={group.vendorName}>
            {showVendorGroups && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Sold by {group.vendorName}
              </p>
            )}
            <div className="space-y-3">
              {group.items.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <img src={item.image} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      Qty: {item.quantity} × {formatPKR(item.unitPrice)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {showVendorGroups && (
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>Subtotal from {group.vendorName}</span>
                <span>{formatPKR(group.vendorSubtotal)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>{formatPKR(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Discount</span>
            <span>–{formatPKR(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-600">
          <span>Shipping</span>
          <span>{shipping === 0 ? <span className="text-green-700">Free</span> : formatPKR(shipping)}</span>
        </div>
        {tax > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Estimated Tax</span>
            <span>{formatPKR(tax)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
          <span>Total</span>
          <span>{formatPKR(total)}</span>
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
