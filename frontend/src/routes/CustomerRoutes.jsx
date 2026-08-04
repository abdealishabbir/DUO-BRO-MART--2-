import { Route } from "react-router-dom";
import CustomerLayout from "../layouts/CustomerLayout.jsx";
import Home from "../pages/customer/Home.jsx";
import Shop from "../pages/customer/Shop.jsx";
import ProductDetail from "../pages/customer/ProductDetail.jsx";
import VendorStorefront from "../pages/customer/VendorStorefront.jsx";
import Cart from "../pages/customer/Cart.jsx";
import Wishlist from "../pages/customer/Wishlist.jsx";
import CheckoutShipping from "../pages/customer/CheckoutShipping.jsx";
import CheckoutPayment from "../pages/customer/CheckoutPayment.jsx";
import CheckoutConfirmation from "../pages/customer/CheckoutConfirmation.jsx";
import TrackOrder from "../pages/customer/TrackOrder.jsx";
import OrderFeedback from "../pages/customer/OrderFeedback.jsx";
import Terms from "../pages/customer/Terms.jsx";
import VendorTerms from "../pages/customer/VendorTerms.jsx";
import Account from "../pages/customer/Account.jsx";
import BecomeVendor from "../pages/customer/BecomeVendor.jsx";
import Feedback from "../pages/customer/Feedback.jsx";
import Login from "../pages/customer/Login.jsx";
import Signup from "../pages/customer/Signup.jsx";
import ForgotPassword from "../pages/customer/ForgotPassword.jsx";
import ResetPassword from "../pages/customer/ResetPassword.jsx";
import VerifyEmail from "../pages/customer/VerifyEmail.jsx";

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
