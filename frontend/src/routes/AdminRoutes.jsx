import { Route } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout.jsx";
import RoleRoute from "./RoleRoute.jsx";
import AdminLogin from "../pages/admin/Login.jsx";
import AdminDashboard from "../pages/admin/Dashboard.jsx";
import AdminProducts from "../pages/admin/Products.jsx";
import AdminBannersPromotion from "../pages/admin/BannersPromotion.jsx";
import AdminOrders from "../pages/admin/Orders.jsx";
import AdminPayouts from "../pages/admin/Payouts.jsx";
import AdminVendors from "../pages/admin/Vendors.jsx";
import AdminPricing from "../pages/admin/Pricing.jsx";
import AdminCoupons from "../pages/admin/Coupons.jsx";
import AdminSettings from "../pages/admin/Settings.jsx";
import AdminComplaints from "../pages/admin/Complaints.jsx";

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
          <Route path="products" element={<AdminProducts />} />
          <Route path="banners" element={<AdminBannersPromotion />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="payouts" element={<AdminPayouts />} />
          <Route path="vendors" element={<AdminVendors />} />
          <Route path="pricing" element={<AdminPricing />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="complaints" element={<AdminComplaints />} />
        </Route>
      </Route>
    </Route>
  );
}
