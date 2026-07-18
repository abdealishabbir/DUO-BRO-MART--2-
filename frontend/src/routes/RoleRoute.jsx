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
 */
export default function RoleRoute({ allowedRoles, redirectTo }) {
  const { role, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (!allowedRoles.includes(role)) {
    // Authenticated, but wrong role for this subtree — send them home
    // rather than looping them into a login page they can't use.
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
