import { lazy } from "react";
import { Route } from "react-router-dom";
import VendorLayout from "../layouts/VendorLayout.jsx";
import RoleRoute from "./RoleRoute.jsx";

const VendorLogin = lazy(() => import("../pages/vendor/Login.jsx"));
const VendorDashboard = lazy(() => import("../pages/vendor/Dashboard.jsx"));
const VendorChangePassword = lazy(() => import("../pages/vendor/ChangePassword.jsx"));
const VendorProducts = lazy(() => import("../pages/vendor/Products.jsx"));
const VendorDeals = lazy(() => import("../pages/vendor/Deals.jsx"));
const VendorStock = lazy(() => import("../pages/vendor/Stock.jsx"));
const VendorOrders = lazy(() => import("../pages/vendor/Orders.jsx"));
const VendorAnalytics = lazy(() => import("../pages/vendor/Analytics.jsx"));
const VendorPayouts = lazy(() => import("../pages/vendor/Payouts.jsx"));
const PromotionBanner = lazy(() => import("../pages/vendor/PromotionBanner.jsx"));
const VendorSettings = lazy(() => import("../pages/vendor/Settings.jsx"));
const VendorSupport = lazy(() => import("../pages/vendor/Support.jsx"));

/**
 * PRD §3.2/§4.1: vendor portal lives on a separate, unadvertised URL
 * (/vendor/login) and is never linked from customer navigation. Everything
 * under /vendor/* except the login page itself is gated to role=vendor.
 * change-password is inside the guarded RoleRoute (needs a valid vendor
 * session) but outside VendorLayout's sidebar shell, since a vendor who
 * hasn't changed their temp password yet shouldn't see full nav (§2.4/§4.3).
 */
export default function VendorRoutes() {
  return (
    <Route path="vendor">
      <Route path="login" element={<VendorLogin />} />
      <Route element={<RoleRoute allowedRoles={["vendor"]} redirectTo="/vendor/login" />}>
        <Route path="change-password" element={<VendorChangePassword />} />
        <Route element={<VendorLayout />}>
          <Route path="dashboard" element={<VendorDashboard />} />
          <Route path="products" element={<VendorProducts />} />
          <Route path="deals" element={<VendorDeals />} />
          <Route path="stock" element={<VendorStock />} />
          <Route path="orders" element={<VendorOrders />} />
          <Route path="analytics" element={<VendorAnalytics />} />
          <Route path="payouts" element={<VendorPayouts />} />
          <Route path="promotion-banner" element={<PromotionBanner />} />
          <Route path="settings" element={<VendorSettings />} />
          <Route path="support" element={<VendorSupport />} />
        </Route>
      </Route>
    </Route>
  );
}
