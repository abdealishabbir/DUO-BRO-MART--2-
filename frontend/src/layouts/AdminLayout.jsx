import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

// Full 7-section admin nav (§6.1-§6.7), all built out as of Phase 6.
const NAV_LINKS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/banners", label: "Banners & Promotion" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/payouts", label: "Payouts" },
  { to: "/admin/vendors", label: "Vendors" },
  { to: "/admin/pricing", label: "Pricing & Commission" },
  { to: "/admin/coupons", label: "Coupons" },
  { to: "/admin/settings", label: "Settings" },
  { to: "/admin/complaints", label: "Complaints" },
];

export default function AdminLayout() {
  const { logout, user } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-gray-800 bg-ink">
        <div className="border-b border-white/10 px-4 py-4">
          <p className="text-sm font-bold text-brand">Duo Bro Mart</p>
          <p className="text-xs text-gray-400">{user?.name ?? "Admin"}</p>
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
      <main className="flex-1 bg-cream">
        <Outlet />
      </main>
    </div>
  );
}
