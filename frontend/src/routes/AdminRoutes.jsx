import { lazy } from "react";
import { Route } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout.jsx";
import RoleRoute from "./RoleRoute.jsx";

// A customer should never download any of this — lazy() means each of
// these only becomes a separate network request the moment someone
// actually navigates to /admin/*, instead of being bundled into the
// same JS every single visitor downloads on first paint.
const AdminLogin = lazy(() => import("../pages/admin/Login.jsx"));
const AdminDashboard = lazy(() => import("../pages/admin/Dashboard.jsx"));
const AdminAnalytics = lazy(() => import("../pages/admin/Analytics.jsx"));
const AdminProducts = lazy(() => import("../pages/admin/Products.jsx"));
const AdminBannersPromotion = lazy(() => import("../pages/admin/BannersPromotion.jsx"));
const AdminOrders = lazy(() => import("../pages/admin/Orders.jsx"));
const AdminPayouts = lazy(() => import("../pages/admin/Payouts.jsx"));
const AdminVendors = lazy(() => import("../pages/admin/Vendors.jsx"));
const AdminPricing = lazy(() => import("../pages/admin/Pricing.jsx"));
const AdminCoupons = lazy(() => import("../pages/admin/Coupons.jsx"));
const AdminSettings = lazy(() => import("../pages/admin/Settings.jsx"));
const AdminAuditLog = lazy(() => import("../pages/admin/AuditLog.jsx"));
const AdminComplaints = lazy(() => import("../pages/admin/Complaints.jsx"));

/**
 * PRD §3.2/§4.1: admin portal lives on a separate, unadvertised URL
 * (/admin/login), provisioned manually — no public signup. Everything
 * under /admin/* except the login page itself is gated to role=admin.
 */
export default function AdminRoutes() {
  return (
    <Route path="admin">
      <Route path="login" element={<AdminLogin />} />
      <Route element={<RoleRoute allowedRoles={["admin"]} redirectTo="/admin/login" />}>
        <Route element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="banners" element={<AdminBannersPromotion />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="payouts" element={<AdminPayouts />} />
          <Route path="vendors" element={<AdminVendors />} />
          <Route path="pricing" element={<AdminPricing />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="audit-log" element={<AdminAuditLog />} />
          <Route path="complaints" element={<AdminComplaints />} />
        </Route>
      </Route>
    </Route>
  );
}
