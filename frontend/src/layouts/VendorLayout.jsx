import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

// Full item set (products, deals, banners, orders, settings) lands with
// Phase 5's actual vendor panel pages (PRD §6); Phase 1 wires the shell only.
const NAV_LINKS = [
  { to: "/vendor/dashboard", label: "Dashboard" },
  { to: "/vendor/promotion-banner", label: "Promotion & Banner" },
];

export default function VendorLayout() {
  const { logout, user } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-4">
          <p className="text-sm font-semibold text-gray-900">Vendor Panel</p>
          <p className="text-xs text-gray-500">{user?.name ?? "Duo Bro Mart"}</p>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-brand/10 text-brand" : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={logout}
            className="mt-4 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-500 hover:bg-gray-100"
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
