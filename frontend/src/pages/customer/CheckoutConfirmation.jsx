import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Truck, MapPin } from "lucide-react";
import { getAllMockOrders } from "../../cart/CheckoutContext.jsx";
import CheckoutSteps from "../../components/CheckoutSteps.jsx";
import { formatPKR } from "../../lib/currency.js";

function formatDateRange(isoDate, daysFrom, daysTo) {
  const base = new Date(isoDate);
  const start = new Date(base);
  start.setDate(start.getDate() + daysFrom);
  const end = new Date(base);
  end.setDate(end.getDate() + daysTo);
  const opts = { month: "long", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)}-${end.getDate()}, ${end.getFullYear()}`;
}

export default function CheckoutConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState(location.state?.order ?? null);

  useEffect(() => {
    // Refreshing this page loses router state — fall back to the most
    // recently placed mock order so the confirmation still renders.
    if (!order) {
      const [latest] = getAllMockOrders();
      if (latest) setOrder(latest);
      else navigate("/", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!order) return null;

  const firstName = order.address?.full_name?.split(" ")[0] || "there";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <CheckoutSteps current={4} />

      <div className="mt-10 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Order Confirmed!</h1>
        <p className="mt-1 text-gray-500">Thank you, {firstName}!</p>

        <span className="mt-4 inline-block rounded-md border border-brand/30 bg-cream px-4 py-1.5 font-mono text-sm font-semibold text-brand">
          #{order.id}
        </span>

        <p className="mx-auto mt-4 max-w-sm text-sm text-gray-500">
          Your order has been placed successfully and is being processed.
          {order.paymentMethod === "cod"
            ? " Please have the total ready for the courier on delivery."
            : " You'll receive a confirmation shortly."}
        </p>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="font-bold text-gray-900">Order Summary</h2>
        <div className="mt-4 space-y-3 border-b border-gray-100 pb-4">
          {order.items.map((item) => (
            <div key={item.slug} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={item.image} alt="" className="h-12 w-12 rounded-md object-cover" />
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-900">{formatPKR(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between text-base font-bold text-gray-900">
          <span>Total Paid</span>
          <span>{formatPKR(order.total)}</span>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-cream px-4 py-3 text-sm">
        <Truck className="h-4 w-4 text-brand" />
        <span className="text-gray-700">Estimated delivery:</span>
        <span className="font-semibold text-brand">
          {formatDateRange(order.placedAt, order.estimatedDeliveryDays, order.estimatedDeliveryDays + 2)}
        </span>
      </div>

      {order.address?.area_type === "rural" && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Collect from nearest courier branch: your area doesn't have door-to-door coverage, so the courier will hold your
            order at its nearest branch near <strong>{order.address.landmark}</strong>. You'll be notified once it arrives there.
          </span>
        </div>
      )}

      <div className="mt-6 flex justify-center gap-3">
        <Link
          to={`/track-order?order=${order.id}`}
          className="rounded-md border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-800 hover:border-brand hover:text-brand"
        >
          Track Your Order
        </Link>
        <Link to="/shop" className="rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
