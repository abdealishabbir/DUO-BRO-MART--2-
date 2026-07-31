import { createContext, useContext, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { api } from "../lib/api.js";

const CheckoutContext = createContext(null);

export function CheckoutProvider({ children }) {
  const { user } = useAuth();
  const [address, setAddress] = useState(null);
  const [deliveryMethod, setDeliveryMethod] = useState("standard");
  const [paymentMethod, setPaymentMethod] = useState("cod");

  /**
   * Places a real order against the Order backend (apps/orders) —
   * replaces the old localStorage mock now that a real Product/Order
   * backend exists.
   *
   * `address` is either:
   *   - a saved accounts.Address (no `email`/`area_type` field exists on
   *     that model — see CheckoutShipping — so email falls back to the
   *     logged-in user's account email, and "rural" is inferred from
   *     whether a landmark was saved against it), or
   *   - a fresh guest/new-address form object from CheckoutShipping,
   *     which *does* carry email/area_type directly.
   */
  const placeOrder = async ({ lines, deliveryMethod: method, billingAddress, wallet, couponCode }) => {
    const isRural = address.area_type ? address.area_type === "rural" : Boolean(address.landmark);

    const body = {
      items: lines.map((l) => ({ product: l.product.id, quantity: l.quantity })),
      shipping_full_name: address.full_name,
      shipping_phone_number: address.phone_number,
      shipping_email: address.email || user?.email || "",
      shipping_province: address.province,
      shipping_city: address.city,
      shipping_address_line: address.address_line,
      shipping_is_rural: isRural,
      shipping_landmark: address.landmark || "",
      billing_same_as_shipping: !billingAddress || billingAddress === address,
      delivery_method: method ?? deliveryMethod,
      payment_method: paymentMethod,
      wallet_provider: paymentMethod === "wallet" ? wallet ?? "" : "",
      coupon_code: couponCode || "",
    };

    if (billingAddress && billingAddress !== address) {
      body.billing_same_as_shipping = false;
      body.billing_full_name = billingAddress.full_name;
      body.billing_phone_number = billingAddress.phone_number;
      body.billing_province = billingAddress.province;
      body.billing_city = billingAddress.city;
      body.billing_address_line = billingAddress.address_line;
    }

    return api.post("/orders/", body);
  };

  const value = { address, setAddress, deliveryMethod, setDeliveryMethod, paymentMethod, setPaymentMethod, placeOrder };

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error("useCheckout must be used within a CheckoutProvider");
  return ctx;
}
