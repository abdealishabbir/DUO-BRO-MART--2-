import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

// PRD §5.1: Home • Shop • Deals • Terms • Become a Vendor • Profile/Account • Cart (with badge)
const NAV_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/shop", label: "Shop" },
  { to: "/shop?deals=1", label: "Deals" },
  { to: "/terms", label: "Terms" },
  { to: "/become-a-vendor", label: "Become a Vendor" },
];

function NavItem({ to, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `block px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          isActive ? "text-brand" : "text-gray-700 hover:text-brand"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function CustomerLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  // Cart badge count wires up to real cart state in Phase 4 (§5.4.2 persistence).
  const cartCount = 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold text-brand">
            Duo Bro Mart
          </Link>

          <nav className="hidden md:flex md:items-center md:gap-1">
            {NAV_LINKS.map((link) => (
              <NavItem key={link.to} {...link} />
            ))}
          </nav>

          <div className="hidden md:flex md:items-center md:gap-4">
            <Link to={isAuthenticated ? "/account" : "/login"} className="text-sm font-medium text-gray-700 hover:text-brand">
              {isAuthenticated ? "Account" : "Sign in"}
            </Link>
            <Link to="/cart" className="relative text-sm font-medium text-gray-700 hover:text-brand">
              Cart
              {cartCount > 0 && (
                <span className="absolute -right-3 -top-2 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="block h-0.5 w-6 bg-gray-800 mb-1" />
            <span className="block h-0.5 w-6 bg-gray-800 mb-1" />
            <span className="block h-0.5 w-6 bg-gray-800" />
          </button>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t border-gray-200 bg-white px-4 py-2">
            {NAV_LINKS.map((link) => (
              <NavItem key={link.to} {...link} />
            ))}
            <NavItem to={isAuthenticated ? "/account" : "/login"} label={isAuthenticated ? "Account" : "Sign in"} />
            <NavItem to="/cart" label={`Cart${cartCount > 0 ? ` (${cartCount})` : ""}`} />
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* PRD §5.2.9: identical footer across all customer pages */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 text-sm text-gray-600 sm:grid-cols-4">
          <div>
            <h3 className="mb-2 font-semibold text-gray-900">Shop</h3>
            <ul className="space-y-1">
              <li><Link to="/shop?deals=1" className="hover:text-brand">Discount Deals</Link></li>
              <li><Link to="/shop?sort=new" className="hover:text-brand">New Arrivals</Link></li>
              <li><Link to="/track-order" className="hover:text-brand">Track Order</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-gray-900">Company</h3>
            <ul className="space-y-1">
              <li><Link to="/terms" className="hover:text-brand">Terms & Conditions</Link></li>
              <li><Link to="/vendor-terms" className="hover:text-brand">Vendor Terms</Link></li>
              <li><Link to="/become-a-vendor" className="hover:text-brand">Become a Vendor</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-gray-900">Support</h3>
            <ul className="space-y-1">
              <li>Refunds & Returns</li>
              <li>Gift Coupons</li>
              <li>Affiliate Program</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-gray-900">Contact</h3>
            <p>support@duobromart.com</p>
          </div>
        </div>
        <div className="border-t border-gray-100 px-4 py-4 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Duo Bro Mart. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
