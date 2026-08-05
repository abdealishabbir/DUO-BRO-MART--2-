import Meta from "../../components/Meta.jsx";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Wallet, Truck, ShieldCheck } from "lucide-react";
import { useCart } from "../../cart/CartContext.jsx";
import { useCheckout } from "../../cart/CheckoutContext.jsx";
import CheckoutSteps from "../../components/CheckoutSteps.jsx";
import OrderSummarySidebar from "../../components/OrderSummarySidebar.jsx";
import FormField, { inputClass } from "../../components/FormField.jsx";
import { PROVINCES, citiesFor } from "../../lib/pkLocations.js";
import { DELIVERY_METHODS } from "./CheckoutShipping.jsx";
import { api } from "../../lib/api.js";

// PRD §5.4: Cash on Delivery is the default/primary payment method for
// the Pakistani market — selected first here, unlike the card-first
// reference layout. Filtered against §6.7's admin-configured gateway
// toggles once /settings/public/ resolves (see useEffect below) — a
// method disabled in Admin Settings simply doesn't appear here, rather
// than being shown and then rejected at checkout.
const ALL_METHODS = [
  { id: "cod", label: "Cash on Delivery", icon: Truck, settingKey: "cod_enabled" },
  { id: "card", label: "Credit/Debit Card", icon: CreditCard, settingKey: "card_enabled" },
  { id: "wallet", label: "Mobile Wallet", icon: Wallet, settingKey: null },
];

// NayaPay has no dedicated admin toggle (see PlatformSettings) — only
// JazzCash/EasyPaisa are individually gateable, so NayaPay always shows
// whenever the Wallet method itself is available.
const ALL_WALLETS = [
  { name: "NayaPay", settingKey: null },
  { name: "Easypaisa", settingKey: "easypaisa_enabled" },
  { name: "JazzCash", settingKey: "jazzcash_enabled" },
];

const DELIVERY_PRICE = Object.fromEntries(DELIVERY_METHODS.map((m) => [m.id, m.price]));

const EMPTY_BILLING = { full_name: "", phone_number: "", province: "sindh", city: "", address_line: "" };

export default function CheckoutPayment() {
  const { lines, subtotal, clearCart } = useCart();
  const { address, deliveryMethod, paymentMethod, setPaymentMethod, placeOrder } = useCheckout();
  const meta = {
    title: "Payment",
    description: "Choose how to pay for your Duo Bro Mart order and complete checkout.",
    url: `${window.location.origin}/checkout/payment`,
  };
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [error, setError] = useState("");
  const [platformSettings, setPlatformSettings] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState("NayaPay");
  const [saveCard, setSaveCard] = useState(false);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingForm, setBillingForm] = useState(EMPTY_BILLING);

  useEffect(() => {
    api.get("/settings/public/").then(setPlatformSettings);
  }, []);

  const METHODS = ALL_METHODS.filter((m) => !platformSettings || !m.settingKey || platformSettings[m.settingKey]);
  const WALLETS = ALL_WALLETS.filter((w) => !platformSettings || !w.settingKey || platformSettings[w.settingKey]).map((w) => w.name);

  useEffect(() => {
    if (lines.length === 0) navigate("/cart", { replace: true });
    else if (!address) navigate("/checkout/shipping", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (lines.length === 0 || !address) return null;

  const shipping = DELIVERY_PRICE[deliveryMethod] ?? 0;
  // meta object already declared above; reuse `meta` variable from module scope

  const handlePlaceOrder = async () => {
    setPlacing(true);
    setError("");
    const billingAddress = billingSameAsShipping ? address : billingForm;
    try {
      const order = await placeOrder({
        lines,
        billingAddress,
        wallet: paymentMethod === "wallet" ? selectedWallet : null,
        couponCode,
      });
      clearCart();
      navigate("/checkout/confirmation", { state: { order } });
    } catch (err) {
      setError(err.data?.detail || Object.values(err.data || {}).flat().join(" ") || "Could not place your order. Please try again.");
      setPlacing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Meta {...meta} />
      <CheckoutSteps current={3} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h1 className="flex items-center gap-2 font-bold text-gray-900">
              <CreditCard className="h-4 w-4 text-brand" /> Payment Details
            </h1>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`flex flex-col items-center gap-1 rounded-md py-3 text-xs font-semibold ${
                    paymentMethod === m.id ? "bg-brand text-white" : "border border-gray-300 text-gray-700 hover:border-brand"
                  }`}
                >
                  <m.icon className="h-4 w-4" />
                  {m.label}
                </button>
              ))}
            </div>

            {paymentMethod === "cod" && (
              <div className="mt-5 flex items-start gap-3 rounded-md border border-gray-200 bg-cream p-4 text-sm">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div>
                  <p className="font-medium text-gray-900">Pay when you receive</p>
                  <p className="text-gray-500">You&apos;ll pay in cash to the courier when your order arrives at your address.</p>
                </div>
              </div>
            )}

            {paymentMethod === "card" && (
              <div className="mt-5 space-y-4">
                {/*
                  Mock-only — no card data is sent anywhere or stored.
                  Real card tokenization needs an actual payment gateway,
                  which is a later phase per the roadmap; wiring this
                  form up for real would need PCI-compliant handling.
                */}
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Card Number</span>
                  <input className={inputClass} placeholder="1234 5678 9012 3456" disabled />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-gray-700">Expiry Date</span>
                    <input className={inputClass} placeholder="MM/YY" disabled />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-gray-700">CVV</span>
                    <input className={inputClass} placeholder="123" disabled />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} />
                  Save this card for future purchases
                </label>
                <p className="text-xs text-gray-400">Card payments aren&apos;t live yet — this is a preview of the upcoming flow.</p>
              </div>
            )}

            {paymentMethod === "wallet" && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {WALLETS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setSelectedWallet(w)}
                      className={`rounded-md border px-3 py-2.5 text-sm font-semibold ${
                        selectedWallet === w ? "border-brand bg-cream text-brand" : "border-gray-300 text-gray-700 hover:border-brand"
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <div className="rounded-md border border-dashed border-gray-300 p-6 text-center">
                  <button disabled className="rounded-full bg-gray-300 px-6 py-2.5 text-sm font-semibold text-white">
                    Continue with {selectedWallet}
                  </button>
                  <p className="mt-2 text-xs text-gray-400">{selectedWallet} redirect/OTP integration isn&apos;t live yet — this is a preview.</p>
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-center gap-4 border-t border-gray-100 pt-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-green-600" /> SSL Encrypted</span>
              <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-green-600" /> Secure Checkout</span>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="font-bold text-gray-900">Delivery Address</h2>
            <p className="mt-2 text-sm text-gray-600">
              {address.full_name} · {address.phone_number}<br />
              {address.address_line}, {address.city}
              {address.landmark && <><br />Landmark: {address.landmark}</>}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="font-bold text-gray-900">Billing Address</h2>
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={billingSameAsShipping} onChange={(e) => setBillingSameAsShipping(e.target.checked)} />
              Same as shipping address
            </label>

            {!billingSameAsShipping && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Full Name">
                    <input className={inputClass} value={billingForm.full_name} onChange={(e) => setBillingForm({ ...billingForm, full_name: e.target.value })} />
                  </FormField>
                  <FormField label="Contact No.">
                    <input className={inputClass} placeholder="03001234567" value={billingForm.phone_number} onChange={(e) => setBillingForm({ ...billingForm, phone_number: e.target.value })} />
                  </FormField>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Province">
                    <select
                      className={inputClass}
                      value={billingForm.province}
                      onChange={(e) => setBillingForm({ ...billingForm, province: e.target.value, city: "" })}
                    >
                      {PROVINCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="City">
                    <select className={inputClass} value={billingForm.city} onChange={(e) => setBillingForm({ ...billingForm, city: e.target.value })}>
                      <option value="" disabled>Select a city</option>
                      {citiesFor(billingForm.province).map((city) => <option key={city} value={city}>{city}</option>)}
                    </select>
                  </FormField>
                </div>
                <FormField label="Address">
                  <input className={inputClass} placeholder="House / street / area" value={billingForm.address_line} onChange={(e) => setBillingForm({ ...billingForm, address_line: e.target.value })} />
                </FormField>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Coupon code (optional)"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => navigate("/checkout/shipping")} className="text-sm font-medium text-gray-600 hover:text-brand">
              Back to Shipping
            </button>
            <div className="text-right">
              {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
              <button
                onClick={handlePlaceOrder}
                disabled={placing}
                className="rounded-md bg-brand px-8 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {placing ? "Placing Order..." : "Place Order"}
              </button>
            </div>
          </div>
        </div>

        <OrderSummarySidebar lines={lines} subtotal={subtotal} shipping={shipping} />
      </div>
    </div>
  );
}
