import { Route } from "react-router-dom";
import VendorLayout from "../layouts/VendorLayout.jsx";
import RoleRoute from "./RoleRoute.jsx";
import VendorLogin from "../pages/vendor/Login.jsx";
import VendorDashboard from "../pages/vendor/Dashboard.jsx";
import VendorChangePassword from "../pages/vendor/ChangePassword.jsx";
import PromotionBanner from "../pages/vendor/PromotionBanner.jsx";

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
          <Route path="promotion-banner" element={<PromotionBanner />} />
        </Route>
      </Route>
    </Route>
  );
}
