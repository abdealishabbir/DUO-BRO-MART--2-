import { ShieldCheck } from "lucide-react";
import { formatPKR } from "../lib/currency.js";
import { groupLinesByVendor } from "../lib/vendorGrouping.js";
import ImageWithFallback from "./ImageWithFallback.jsx";
import Card from "./Card.jsx";

export default function OrderSummarySidebar({ lines, subtotal, shipping, tax = 0, discount = 0 }) {
  // subtotal already reflects each line's current (deal) price — see
  // CartContext, which sums product.price × quantity, not
  // original_price. `discount` here is purely the informational "you
  // saved Rs. X from active deals" figure for display, so it must NOT
  // be subtracted again below; doing so was double-counting the same
  // discount and showing a lower total on this page than what checkout
  // (correctly, since it never received a discount prop at all) would
  // actually charge.
  const total = subtotal + shipping + tax;

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
    <Card padding="none" className="h-fit p-5">
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
                  <ImageWithFallback src={item.image} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" iconClassName="h-5 w-5" />
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

      {/* No coupon box here — the real, working one lives on
          CheckoutPayment right before "Place Order," wired to the
          backend's actual validate-at-order-creation contract
          (coupon_code sent with the order, applied server-side, shown
          on the confirmation page). This page previously had a second,
          decorative one — no value/onChange on the input, submit
          handler was only e.preventDefault() — sitting right next to
          the totals a customer is deciding whether to trust. Removed
          rather than left silently broken. */}

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5 text-green-600" /> Secure Checkout
      </p>
    </Card>
  );
}
