import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "../auth/AuthContext.jsx";
import { CartProvider } from "../cart/CartContext.jsx";
import { WishlistProvider } from "../wishlist/WishlistContext.jsx";
import { CheckoutProvider } from "../cart/CheckoutContext.jsx";

/**
 * Mirrors the exact provider nesting in main.jsx, so a component that
 * works in this wrapper behaves the same as it does in the real app —
 * no test-only shortcuts that could hide a missing-provider bug.
 *
 * `route` / `path`: for components that read useParams() (e.g.
 * ProductDetail's :slug). Defaults to a plain "/" with no params, which
 * covers the majority of components that don't need a param.
 */
export function renderWithProviders(ui, { route = "/", path = "/", ...renderOptions } = {}) {
  function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <CheckoutProvider>
                <HelmetProvider>
                  <Routes>
                    <Route path={path} element={children} />
                    {/* Catches wherever a login/checkout success redirects to (e.g. /shop,
                        /checkout/confirmation) so React Router doesn't warn about an
                        unmatched location — the destination page itself isn't under test
                        here, just that navigation away actually happened. */}
                    <Route path="*" element={null} />
                  </Routes>
                </HelmetProvider>
              </CheckoutProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from RTL so test files only need one import line.
export * from "@testing-library/react";
