import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

// Full 7-section nav (dashboard, products, banners, orders, vendors,
// pricing, settings) lands with Phase 6's admin panel pages (PRD §7);
// Phase 1 wires the shell only.
const NAV_LINKS = [
  { to: "/admin/dashboard", label: "Dashboard" },
];

export default function AdminLayout() {
  const { logout, user } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-gray-900">
        <div className="border-b border-gray-800 px-4 py-4">
          <p className="text-sm font-semibold text-white">Admin Panel</p>
          <p className="text-xs text-gray-400">{user?.name ?? "Duo Bro Mart"}</p>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={logout}
            className="mt-4 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-400 hover:bg-white/5"
          >
            Log out
          </button>
        </nav>
      </aside>
      <main className="flex-1 bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
