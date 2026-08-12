import { lazy } from "react";
import { Route } from "react-router-dom";
import CustomerLayout from "../layouts/CustomerLayout.jsx";
import Home from "../pages/customer/Home.jsx";

// Home stays a normal (eager) import — it's the entry point virtually
// every visitor needs on first paint, so lazy-loading it wouldn't save
// any bytes for the common case, only add a loading flash. Everything
// below genuinely benefits: a visitor just browsing Shop never needs
// Checkout's or Account's JS downloaded at all.
const Shop = lazy(() => import("../pages/customer/Shop.jsx"));
const ProductDetail = lazy(() => import("../pages/customer/ProductDetail.jsx"));
const VendorStorefront = lazy(() => import("../pages/customer/VendorStorefront.jsx"));
const Cart = lazy(() => import("../pages/customer/Cart.jsx"));
const Wishlist = lazy(() => import("../pages/customer/Wishlist.jsx"));
const CheckoutShipping = lazy(() => import("../pages/customer/CheckoutShipping.jsx"));
const CheckoutPayment = lazy(() => import("../pages/customer/CheckoutPayment.jsx"));
const CheckoutConfirmation = lazy(() => import("../pages/customer/CheckoutConfirmation.jsx"));
const TrackOrder = lazy(() => import("../pages/customer/TrackOrder.jsx"));
const OrderFeedback = lazy(() => import("../pages/customer/OrderFeedback.jsx"));
const Terms = lazy(() => import("../pages/customer/Terms.jsx"));
const VendorTerms = lazy(() => import("../pages/customer/VendorTerms.jsx"));
const Account = lazy(() => import("../pages/customer/Account.jsx"));
const BecomeVendor = lazy(() => import("../pages/customer/BecomeVendor.jsx"));
const Feedback = lazy(() => import("../pages/customer/Feedback.jsx"));
const Login = lazy(() => import("../pages/customer/Login.jsx"));
const Signup = lazy(() => import("../pages/customer/Signup.jsx"));
const ForgotPassword = lazy(() => import("../pages/customer/ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("../pages/customer/ResetPassword.jsx"));
const VerifyEmail = lazy(() => import("../pages/customer/VerifyEmail.jsx"));

/**
 * PRD §3.2 page inventory — customer channel. This is the default
 * experience at duobromart.com (routing rule in §3.2): every normal
 * visitor lands here regardless of what they type after the domain,
 * except the two hidden vendor/admin login URLs handled separately.
 */
export default function CustomerRoutes() {
  return (
    <Route element={<CustomerLayout />}>
      <Route index element={<Home />} />
      <Route path="shop" element={<Shop />} />
      <Route path="product/:slug" element={<ProductDetail />} />
      <Route path="store/:vendorId" element={<VendorStorefront />} />
      <Route path="cart" element={<Cart />} />
      <Route path="wishlist" element={<Wishlist />} />
      <Route path="checkout/shipping" element={<CheckoutShipping />} />
      <Route path="checkout/payment" element={<CheckoutPayment />} />
      <Route path="checkout/confirmation" element={<CheckoutConfirmation />} />
      <Route path="track-order" element={<TrackOrder />} />
      <Route path="order-feedback/:orderCode" element={<OrderFeedback />} />
      <Route path="terms" element={<Terms />} />
      <Route path="vendor-terms" element={<VendorTerms />} />
      <Route path="account" element={<Account />} />
      <Route path="become-a-vendor" element={<BecomeVendor />} />
      <Route path="feedback/:orderId" element={<Feedback />} />
      <Route path="login" element={<Login />} />
      <Route path="signup" element={<Signup />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password/:token" element={<ResetPassword />} />
      <Route path="verify-email/:token" element={<VerifyEmail />} />
    </Route>
  );
}
