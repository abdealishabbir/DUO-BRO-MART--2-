import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { CartProvider } from "./cart/CartContext.jsx";
import { WishlistProvider } from "./wishlist/WishlistContext.jsx";
import { CheckoutProvider } from "./cart/CheckoutContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <CheckoutProvider>
              <HelmetProvider>
                <App />
              </HelmetProvider>
            </CheckoutProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
