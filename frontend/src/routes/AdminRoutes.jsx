import { Route } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout.jsx";
import RoleRoute from "./RoleRoute.jsx";
import AdminLogin from "../pages/admin/Login.jsx";
import AdminDashboard from "../pages/admin/Dashboard.jsx";
import AdminProducts from "../pages/admin/Products.jsx";
import AdminBannersPromotion from "../pages/admin/BannersPromotion.jsx";
import AdminOrders from "../pages/admin/Orders.jsx";
import AdminVendors from "../pages/admin/Vendors.jsx";

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
          <Route path="vendors" element={<AdminVendors />} />
        </Route>
      </Route>
    </Route>
  );
}
