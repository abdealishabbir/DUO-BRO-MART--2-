import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Store, LayoutGrid, Package, ClipboardList, BarChart3, Wallet, Settings, HelpCircle, LogOut, Bell, Percent, Boxes,
  AlertTriangle, Info, CheckCircle2, Menu, X,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import { api } from "../lib/api.js";
import ThemeSwitcher from "../theme/ThemeSwitcher.jsx";

const LOW_STOCK_THRESHOLD = 10;

const NAV_LINKS = [
  { to: "/vendor/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/vendor/products", label: "Products", icon: Package },
  { to: "/vendor/deals", label: "Deals & Pricing", icon: Percent },
  { to: "/vendor/stock", label: "Stock Requests", icon: Boxes },
  { to: "/vendor/orders", label: "Orders", icon: ClipboardList },
  { to: "/vendor/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/vendor/payouts", label: "Payouts", icon: Wallet },
  { to: "/vendor/promotion-banner", label: "Promotion & Banner", icon: Bell },
  { to: "/vendor/settings", label: "Settings", icon: Settings },
  { to: "/vendor/support", label: "Support", icon: HelpCircle },
];

function initials(name) {
  return (name ?? "V")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const menuRef = useRef(null);

  useEffect(() => {
    function loadNotifications() {
      Promise.all([
        api.get("/products/vendor/products/?page_size=200").catch(() => null),
        api.get("/banners/vendor/applications/").catch(() => null),
      ]).then(([productsRes, bannersRes]) => {
        const products = productsRes?.results ?? [];
        const bannerApps = bannersRes?.results ?? bannersRes ?? [];
        const items = [];

        const rejected = products.filter((p) => p.status === "rejected");
        rejected.forEach((p) => items.push({
          id: `rejected-${p.id}`, icon: AlertTriangle, tone: "text-red-600 bg-red-50",
          text: `"${p.name}" was rejected — check admin notes and resubmit.`,
        }));

        const lowStock = products.filter((p) => p.status === "approved" && p.stock_quantity <= LOW_STOCK_THRESHOLD);
        lowStock.forEach((p) => items.push({
          id: `low-stock-${p.id}`, icon: AlertTriangle, tone: "text-amber-600 bg-amber-50",
          text: `"${p.name}" is low on stock (${p.stock_quantity} left).`,
        }));

        const pendingBanner = bannerApps.find((b) => b.status === "pending");
        if (pendingBanner) {
          items.push({
            id: "pending-banner", icon: Info, tone: "text-blue-600 bg-blue-50",
            text: "Your banner application is under review.",
          });
        }

        setNotifications(items);
      });
    }
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setOpen((v) => !v)} className="relative text-gray-400 hover:text-gray-600" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {notifications.length > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-lg border border-gray-100 bg-surface p-2 shadow-lg">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Notifications</p>
          {notifications.length === 0 ? (
            <div className="flex items-center gap-2 px-2 py-4 text-sm text-gray-500">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> All caught up — nothing needs your attention.
            </div>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className={`flex items-start gap-2 rounded-md px-2 py-2 text-sm ${n.tone}`}>
                  <n.icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{n.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function VendorLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const storeName = user?.business_name || user?.name || "Your Store";
  const pageTitle = NAV_LINKS.find((l) => location.pathname.startsWith(l.to))?.label ?? "Vendor Portal";

  // The sidebar is a fixed off-canvas drawer below lg (there's no room for a
  // permanent 240px rail next to real content until then). Close it whenever
  // the route changes — nothing is more annoying than tapping a nav link on
  // a phone and having the drawer just sit there over the new page.
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
    <div className="flex min-h-dvh bg-gray-50">
      <a href="#maincontent" className="sr-only focus:not-sr-only inline-block rounded bg-surface px-3 py-2 text-sm font-medium text-brand">
        Skip to main content
      </a>
      {sidebarOpen && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col bg-ink text-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
              <Store className="h-4 w-4 text-white" />
            </span>
            <div>
              <p className="text-sm font-bold leading-tight">Duo Bro Mart</p>
              <p className="text-[11px] text-white/50">Vendor Portal</p>
            </div>
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

        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-bold">
            {initials(storeName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{storeName}</p>
            <p className="truncate text-[11px] text-white/50">{user?.email}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Verified Vendor
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-brand text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <link.icon className="h-4 w-4 shrink-0" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-surface px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-800 lg:hidden"
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-heading">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <NotificationsBell />
            <Link to="/vendor/settings" className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-50" title="Account settings">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {initials(user?.name)}
              </span>
              <span className="hidden text-sm font-medium text-heading sm:inline">{user?.name}</span>
            </Link>
          </div>
        </header>

        <main id="maincontent" className="flex-1 bg-cream p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
