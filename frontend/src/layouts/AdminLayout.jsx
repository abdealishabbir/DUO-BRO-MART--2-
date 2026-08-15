import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X, Store } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";

// Full 7-section admin nav (§6.1-§6.7), all built out as of Phase 6.
const NAV_LINKS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/analytics", label: "Analytics" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/banners", label: "Banners & Promotion" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/payouts", label: "Payouts" },
  { to: "/admin/vendors", label: "Vendors" },
  { to: "/admin/pricing", label: "Pricing & Commission" },
  { to: "/admin/coupons", label: "Coupons" },
  { to: "/admin/settings", label: "Settings" },
  { to: "/admin/audit-log", label: "Audit Log" },
  { to: "/admin/complaints", label: "Complaints" },
];

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (e) => e.key === "Escape" && setSidebarOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen">
      <a href="#maincontent" className="sr-only focus:not-sr-only inline-block rounded bg-white px-3 py-2 text-sm font-medium text-brand">
        Skip to main content
      </a>

      {sidebarOpen && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 shrink-0 overflow-y-auto border-r border-gray-800 bg-ink transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
          <div>
            <p className="text-sm font-bold text-brand">Duo Bro Mart</p>
            <p className="text-xs text-gray-400">{user?.name ?? "Admin"}</p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="text-white/60 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-brand text-white" : "text-gray-300 hover:bg-white/5"
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

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Store className="h-4 w-4 text-brand" />
            <span className="text-sm font-bold text-ink">Duo Bro Mart Admin</span>
          </div>
        </header>

        <main id="maincontent" className="flex-1 bg-cream">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
