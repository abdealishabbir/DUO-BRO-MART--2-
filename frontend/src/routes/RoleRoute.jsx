import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

/**
 * Guards a route subtree to a set of allowed roles.
 *
 * PRD §3.2 routing rule: duobromart.com always lands normal visitors on
 * the customer experience; vendor/admin login pages are never linked from
 * customer nav. This component enforces the flip side of that rule at
 * runtime — if someone lands on /vendor/* or /admin/* without the right
 * role, they're bounced to that portal's own login, not the customer one.
 *
 * `loading` (Phase 2): auth state now comes from an async /account/me/
 * check on mount (AuthContext), so there's a brief window where we don't
 * yet know if there's a valid session cookie. Render nothing during that
 * window rather than redirecting prematurely.
 */
export default function RoleRoute({ allowedRoles, redirectTo }) {
  const { role, isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (!allowedRoles.includes(role)) {
    // Authenticated, but wrong role for this subtree — send them home
    // rather than looping them into a login page they can't use.
    return <Navigate to="/" replace />;
  }

  // §2.4/§4.3: a vendor with an admin-issued temp password must change it
  // before touching anything else in the vendor panel.
  if (role === "vendor" && user?.must_change_password && !window.location.pathname.endsWith("/change-password")) {
    return <Navigate to="/vendor/change-password" replace />;
  }

  return <Outlet />;
}
