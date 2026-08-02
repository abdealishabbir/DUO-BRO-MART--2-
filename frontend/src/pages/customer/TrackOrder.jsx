import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, CheckCircle2, Circle, Truck, PackageCheck, Clock, MapPin, XCircle } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { inputClass } from "../../components/FormField.jsx";

// PRD §5.4: Pending -> Processing -> Shipped -> Delivered (or Cancelled).
// The admin updates this status from their panel (§6.4) — this page
// reads whatever the current `status` on the order is.
const STEPS = [
  { id: "pending", label: "Pending", icon: Clock },
  { id: "processing", label: "Processing", icon: PackageCheck },
  { id: "shipped", label: "Shipped", icon: Truck },
  { id: "delivered", label: "Delivered", icon: CheckCircle2 },
];

function formatDate(iso, daysFrom) {
  const d = new Date(iso);
  d.setDate(d.getDate() + daysFrom);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const [orderCode, setOrderCode] = useState(searchParams.get("order") ?? "");
  const [contact, setContact] = useState("");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError("");
    setOrder(null);
    setLoading(true);
    try {
      const found = await api.get(`/orders/track/?order_code=${encodeURIComponent(orderCode.trim())}&contact=${encodeURIComponent(contact.trim())}`);
      setOrder(found);
    } catch (err) {
      setError(err.data?.detail || "We couldn't find that order. Please check the details and try again.");
    } finally {
      setLoading(false);
    }
  };

  const isCancelled = order?.status === "cancelled";
  const currentStepIndex = STEPS.findIndex((s) => s.id === order?.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Track Your Order</h1>
      <p className="mt-1 text-sm text-gray-500">Enter your Order ID and the email or phone number used at checkout.</p>

      <form onSubmit={handleSearch} className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Order ID</span>
          <input className={inputClass} placeholder="DBM-2026-0001" value={orderCode} onChange={(e) => setOrderCode(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Email or Phone Number</span>
          <input className={inputClass} placeholder="you@example.com or 03001234567" value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
          <Search className="h-4 w-4" /> {loading ? "Searching..." : "Track Order"}
        </button>
      </form>

      {order && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Order #{order.order_code}</h2>
            <span className="text-sm text-gray-500">Placed {formatDate(order.created_at, 0)}</span>
          </div>

          {isCancelled ? (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <XCircle className="h-4 w-4" /> This order has been cancelled.
            </div>
          ) : (
            <div className="mt-6 flex items-center justify-between">
              {STEPS.map((step, i) => {
                const reached = i <= currentStepIndex;
                return (
                  <div key={step.id} className="flex flex-1 flex-col items-center text-center">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${reached ? "bg-brand text-white" : "bg-gray-100 text-gray-400"}`}>
                      {reached ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    </span>
                    <span className={`mt-1 text-xs font-medium ${reached ? "text-gray-900" : "text-gray-400"}`}>{step.label}</span>
                    {i < STEPS.length - 1 && <span className={`mt-4 h-0.5 w-full ${i < currentStepIndex ? "bg-brand" : "bg-gray-200"}`} />}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex items-center gap-2 rounded-md border border-gray-200 bg-cream px-4 py-3 text-sm">
            <Truck className="h-4 w-4 text-brand" />
            <span className="text-gray-700">Estimated delivery:</span>
            <span className="font-semibold text-brand">{formatDate(order.created_at, order.estimated_delivery_days)}</span>
          </div>

          {order.status === "shipped" && order.courier_name && (
            <p className="mt-3 text-sm text-gray-600">Courier: {order.courier_name}</p>
          )}

          {order.shipping_is_rural && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Collect from nearest courier branch near <strong>{order.shipping_landmark}</strong> once marked Shipped.
              </span>
            </div>
          )}

          <div className="mt-6 space-y-2 border-t border-gray-100 pt-4 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatPKR(order.subtotal)}</span>
            </div>
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Coupon applied{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                <span>–{formatPKR(order.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span>{Number(order.shipping_fee) === 0 ? <span className="text-green-700">Free</span> : formatPKR(order.shipping_fee)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
              <span>Total</span>
              <span>{formatPKR(order.total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
