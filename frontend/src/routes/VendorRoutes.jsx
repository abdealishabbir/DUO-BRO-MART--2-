import { Route } from "react-router-dom";
import VendorLayout from "../layouts/VendorLayout.jsx";
import RoleRoute from "./RoleRoute.jsx";
import VendorLogin from "../pages/vendor/Login.jsx";
import VendorDashboard from "../pages/vendor/Dashboard.jsx";

/**
 * PRD §3.2/§4.1: vendor portal lives on a separate, unadvertised URL
 * (/vendor/login) and is never linked from customer navigation. Everything
 * under /vendor/* except the login page itself is gated to role=vendor.
 */
export default function VendorRoutes() {
  return (
    <Route path="vendor">
      <Route path="login" element={<VendorLogin />} />
      <Route element={<RoleRoute allowedRoles={["vendor"]} redirectTo="/vendor/login" />}>
        <Route element={<VendorLayout />}>
          <Route path="dashboard" element={<VendorDashboard />} />
        </Route>
      </Route>
    </Route>
  );
}
