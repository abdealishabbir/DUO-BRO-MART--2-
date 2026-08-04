import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Store, User, ShoppingCart, Heart, Menu, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import { useCart } from "../cart/CartContext.jsx";
import { useWishlist } from "../wishlist/WishlistContext.jsx";
import SearchAutocomplete from "../components/SearchAutocomplete.jsx";

// Matched to the ShopNest reference (see UI_BUILD_TRACKER.md for the
// nav/footer -> route mapping). "Vendors" here plays the role our PRD
// calls "Become a Vendor" (§3.2); "Deals" has no separate page in our
// route inventory, so it filters the Shop page instead.
const NAV_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/shop", label: "Shop" },
  { to: "/shop?deals=1", label: "Deals" },
  { to: "/become-a-vendor", label: "Vendors" },
];

function NavItem({ to, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `text-sm font-medium transition-colors ${
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
  const { itemCount: cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-cream">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <Store className="h-6 w-6 text-brand" strokeWidth={2.25} />
            <span className="text-xl font-bold text-gray-900">Duo Bro Mart</span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((link) => (
              <NavItem key={link.label} {...link} />
            ))}
          </nav>

          <div className="hidden flex-1 items-center lg:flex">
            <div className="relative w-full max-w-xl">
              <SearchAutocomplete />
            </div>
          </div>

          <div className="ml-auto hidden items-center gap-6 lg:flex">
            <Link
              to={isAuthenticated ? "/account" : "/login"}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-brand"
            >
              <User className="h-4 w-4" />
              {isAuthenticated ? "Account" : "Sign in"}
            </Link>
            <Link to="/wishlist" className="relative flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-brand">
              <Heart className="h-4 w-4" />
              Wishlist
              {wishlistCount > 0 && (
                <span className="absolute -right-3 -top-2 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link to="/cart" className="relative flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-brand">
              <ShoppingCart className="h-4 w-4" />
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
            className="ml-auto lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-6 w-6 text-gray-800" /> : <Menu className="h-6 w-6 text-gray-800" />}
          </button>
        </div>

        {menuOpen && (
          <nav className="space-y-3 border-t border-gray-200 bg-cream px-4 py-3 lg:hidden">
            <SearchAutocomplete placeholder="Search..." onNavigate={() => setMenuOpen(false)} />
            <div className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <NavItem key={link.label} {...link} />
              ))}
              <NavItem to={isAuthenticated ? "/account" : "/login"} label={isAuthenticated ? "Account" : "Sign in"} />
              <NavItem to="/wishlist" label={`Wishlist${wishlistCount > 0 ? ` (${wishlistCount})` : ""}`} />
              <NavItem to="/cart" label={`Cart${cartCount > 0 ? ` (${cartCount})` : ""}`} />
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-ink text-gray-300">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-4 lg:px-8">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-brand" />
              <span className="text-lg font-bold text-white">Duo Bro Mart</span>
            </div>
            <p className="mt-3 text-sm text-gray-400">
              Pakistan's neighborhood marketplace, online. Handpicked everyday items and unique finds from local sellers.
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Shop</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/shop?sort=new" className="hover:text-brand">New Arrivals</Link></li>
              <li><Link to="/shop?sort=best" className="hover:text-brand">Best Sellers</Link></li>
              <li><Link to="/shop?deals=1" className="hover:text-brand">Deals & Discounts</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Support</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/track-order" className="hover:text-brand">Track Order</Link></li>
              <li><span className="cursor-default text-gray-500">Returns &amp; Refunds</span></li>
              <li><span className="cursor-default text-gray-500">Contact Us</span></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Business</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/become-a-vendor" className="hover:text-brand">Become a Vendor</Link></li>
              <li><Link to="/vendor/login" className="hover:text-brand">Seller Dashboard</Link></li>
              <li><Link to="/vendor-terms" className="hover:text-brand">Vendor Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-4 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-xs text-gray-500 sm:flex-row">
            <p>&copy; {new Date().getFullYear()} Duo Bro Mart. All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/terms" className="hover:text-brand">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
