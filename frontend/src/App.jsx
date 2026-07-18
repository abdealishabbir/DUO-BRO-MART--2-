import { Routes, Route } from "react-router-dom";
import CustomerRoutes from "./routes/CustomerRoutes.jsx";
import VendorRoutes from "./routes/VendorRoutes.jsx";
import AdminRoutes from "./routes/AdminRoutes.jsx";
import NotFound from "./pages/NotFound.jsx";

/**
 * Note: CustomerRoutes()/VendorRoutes()/AdminRoutes() are called as plain
 * functions here (not rendered as JSX components) so the <Route> elements
 * they build are spliced directly into <Routes>'s children — React Router
 * needs to see real <Route>/<Fragment> elements at this level, not a
 * custom component it would have to render first.
 */
export default function App() {
  return (
    <Routes>
      {CustomerRoutes()}
      {VendorRoutes()}
      {AdminRoutes()}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
