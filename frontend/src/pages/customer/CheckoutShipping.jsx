import Meta from "../../components/Meta.jsx";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Zap, Clock, Plus, ArrowRight } from "lucide-react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { useCart } from "../../cart/CartContext.jsx";
import { useCheckout } from "../../cart/CheckoutContext.jsx";
import { api } from "../../lib/api.js";
import FormField, { inputClass } from "../../components/FormField.jsx";
import CheckoutSteps from "../../components/CheckoutSteps.jsx";
import OrderSummarySidebar from "../../components/OrderSummarySidebar.jsx";
import { PROVINCES, citiesFor } from "../../lib/pkLocations.js";
import { formatPKR, DEFAULT_SHIPPING_RATE } from "../../lib/currency.js";

// PRD §5.4: three named tiers — Standard (5-7 days, economical/default,
// PKR 250 base), Express (3-4 days, moderate), Urgent (24-48 hrs, highest).
export const DELIVERY_METHODS = [
  { id: "standard", label: "Standard Delivery", desc: "5-7 business days", price: DEFAULT_SHIPPING_RATE, icon: Truck },
  { id: "express", label: "Express Delivery", desc: "3-4 business days", price: 450, icon: Zap },
  { id: "urgent", label: "Urgent Delivery", desc: "24-48 hours", price: 800, icon: Clock },
];

const EMPTY_FORM = {
  label: "Home",
  full_name: "",
  phone_number: "",
  email: "",
  province: "sindh",
  city: "",
  address_line: "",
  area_type: "city",
  landmark: "",
};

export default function CheckoutShipping() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { lines, subtotal } = useCart();
  const { address, setAddress, deliveryMethod, setDeliveryMethod } = useCheckout();
  const meta = {
    title: "Shipping Details",
    description: "Enter shipping information and choose a delivery method for your Duo Bro Mart order.",
    url: `${window.location.origin}/checkout/shipping`,
  };
  const navigate = useNavigate();

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState(address?.id ?? null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveForLater, setSaveForLater] = useState(true);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lines.length === 0) navigate("/cart", { replace: true });
  }, [lines.length, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingAddresses(true);
    api.get("/account/addresses/").then((data) => {
      const results = data.results ?? data;
      setSavedAddresses(results);
      const defaultAddr = results.find((a) => a.is_default) || results[0];
      if (defaultAddr && !selectedId) setSelectedId(defaultAddr.id);
      if (results.length === 0) setShowForm(true);
      setLoadingAddresses(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) setShowForm(true);
  }, [isAuthenticated, authLoading]);

  const selectedMethod = DELIVERY_METHODS.find((m) => m.id === deliveryMethod) ?? DELIVERY_METHODS[0];

  const handleContinue = async (e) => {
    e.preventDefault();
    setError("");

    if (!showForm) {
      const chosen = savedAddresses.find((a) => a.id === selectedId);
      if (!chosen) {
        setError("Please select or add a delivery address.");
        return;
      }
      setAddress(chosen);
      navigate("/checkout/payment");
      return;
    }

    if (!form.full_name || !form.phone_number || !form.email || !form.city || !form.address_line) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (form.area_type === "rural" && !form.landmark) {
      setError("Nearest landmark is required for rural delivery.");
      return;
    }

    setSubmitting(true);
    try {
      if (isAuthenticated && saveForLater) {
        const saved = await api.post("/account/addresses/", form);
        setAddress(saved);
      } else {
        setAddress({ ...form, id: "guest" });
      }
      navigate("/checkout/payment");
    } catch (err) {
      setError(err.data?.detail || Object.values(err.data || {}).flat().join(" ") || "Could not save this address.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Meta {...meta} />
      <div className="mx-auto max-w-6xl px-4 py-8">
      <CheckoutSteps current={2} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h1 className="flex items-center gap-2 font-bold text-gray-900">
              <Truck className="h-4 w-4 text-brand" /> Shipping Details
            </h1>

            {isAuthenticated && loadingAddresses && <p className="mt-4 text-sm text-gray-500">Loading your addresses...</p>}

            {isAuthenticated && !loadingAddresses && savedAddresses.length > 0 && !showForm && (
              <div className="mt-4 space-y-2">
                {savedAddresses.map((a) => (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${selectedId === a.id ? "border-brand bg-cream" : "border-gray-200"}`}
                  >
                    <input type="radio" name="address" className="mt-1" checked={selectedId === a.id} onChange={() => setSelectedId(a.id)} />
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">
                        {a.label} {a.is_default && <span className="text-xs text-brand">(default)</span>}
                      </p>
                      <p className="text-gray-500">{a.full_name} · {a.phone_number}</p>
                      <p className="text-gray-500">{a.address_line}, {a.city}, {PROVINCES.find((p) => p[0] === a.province)?.[1]}</p>
                      {a.landmark && <p className="text-gray-400">Landmark: {a.landmark}</p>}
                    </div>
                  </label>
                ))}
                <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Use a new address
                </button>
              </div>
            )}

            {showForm && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Full Name"><input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></FormField>
                  <FormField label="Contact No."><input className={inputClass} placeholder="03001234567" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></FormField>
                </div>
                <FormField label="Email Address">
                  <input type="email" className={inputClass} placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Province">
                    <select
                      className={inputClass}
                      value={form.province}
                      onChange={(e) => setForm({ ...form, province: e.target.value, city: "" })}
                    >
                      {PROVINCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="City">
                    <select className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
                      <option value="" disabled>Select a city</option>
                      {citiesFor(form.province).map((city) => <option key={city} value={city}>{city}</option>)}
                    </select>
                  </FormField>
                </div>
                <FormField label="Delivery Address (street no., building, flat no., floor)">
                  <textarea
                    className={`${inputClass} min-h-[84px] resize-y`}
                    placeholder="House / street no., building name, flat no., floor"
                    value={form.address_line}
                    onChange={(e) => setForm({ ...form, address_line: e.target.value })}
                  />
                </FormField>

                <FormField label="Area Type">
                  <div className="flex gap-2">
                    {[["city", "City"], ["rural", "Rural"]].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm({ ...form, area_type: value })}
                        className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium ${
                          form.area_type === value ? "border-brand bg-cream text-brand" : "border-gray-300 text-gray-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </FormField>

                {form.area_type === "rural" && (
                  <p className="-mt-2 text-xs text-gray-500">
                    No door-to-door courier coverage here? The courier will deliver to its nearest branch and you&apos;ll collect from there — tell us the nearest landmark below.
                  </p>
                )}

                <FormField label={form.area_type === "rural" ? "Nearest Landmark (required for rural delivery)" : "Nearest Landmark (optional)"}>
                  <input className={inputClass} placeholder="e.g. Near DHA Phase 6 Gate, behind Agha's Superstore" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
                </FormField>
                {isAuthenticated && (
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={saveForLater} onChange={(e) => setSaveForLater(e.target.checked)} />
                    Save this address to my account
                  </label>
                )}
                {savedAddresses.length > 0 && (
                  <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:underline">
                    Use a saved address instead
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="font-bold text-gray-900">Delivery Method</h2>
            <div className="mt-3 space-y-2">
              {DELIVERY_METHODS.map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 ${deliveryMethod === m.id ? "border-brand bg-cream" : "border-gray-200"}`}
                >
                  <div className="flex items-center gap-3">
                    <input type="radio" name="delivery" className="sr-only" checked={deliveryMethod === m.id} onChange={() => setDeliveryMethod(m.id)} />
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${deliveryMethod === m.id ? "bg-brand text-white" : "bg-gray-100 text-gray-500"}`}>
                      <m.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                      <p className="text-xs text-gray-500">{m.desc}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{m.price === 0 ? "Free" : formatPKR(m.price)}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between">
            <button onClick={() => navigate("/cart")} className="text-sm font-medium text-gray-600 hover:text-brand">
              Back to Cart
            </button>
            <button
              onClick={handleContinue}
              disabled={submitting}
              className="flex items-center gap-2 rounded-md bg-ink px-6 py-3 text-base font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              Continue to Payment <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <OrderSummarySidebar lines={lines} subtotal={subtotal} shipping={selectedMethod.price} />
      </div>
    </div>
    </>
  );
}
