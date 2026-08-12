import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import CustomerRoutes from "./routes/CustomerRoutes.jsx";
import VendorRoutes from "./routes/VendorRoutes.jsx";
import AdminRoutes from "./routes/AdminRoutes.jsx";
import NotFound from "./pages/NotFound.jsx";
import ScrollManager from "./components/ScrollManager.jsx";

/**
 * Note: CustomerRoutes()/VendorRoutes()/AdminRoutes() are called as plain
 * functions here (not rendered as JSX components) so the <Route> elements
 * they build are spliced directly into <Routes>'s children — React Router
 * needs to see real <Route>/<Fragment> elements at this level, not a
 * custom component it would have to render first.
 *
 * One <Suspense> boundary here covers every lazy()-loaded page across all
 * three route files — Suspense just needs to be *any* ancestor above the
 * lazy component in the render tree, not immediately adjacent to it, so
 * wrapping the whole <Routes> tree once is simpler than repeating a
 * boundary inside each route file.
 */
function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand" />
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {CustomerRoutes()}
          {VendorRoutes()}
          {AdminRoutes()}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}
