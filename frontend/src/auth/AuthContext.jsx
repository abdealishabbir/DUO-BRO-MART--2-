import { createContext, useContext, useMemo, useState } from "react";

/**
 * Phase 1 scope: this context only tracks a `role` in memory so the route
 * guards (RoleRoute) and layouts have something real to key off of. There
 * is NO real authentication here yet — no tokens, no persistence, no
 * backend calls. Phase 2 replaces `login`/`logout` with real calls to
 * /api/auth/... (§4) and persists the session (refresh token, "keep me
 * logged in" per §4.2). The shape of this context (role, user, login,
 * logout, isAuthenticated) is deliberately kept stable so Phase 2 can
 * swap the implementation without touching every consumer.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRole] = useState(null); // null | "customer" | "vendor" | "admin"
  const [user, setUser] = useState(null);

  // Dev-only helper until Phase 2 wires real auth endpoints.
  const login = (nextRole, nextUser = { name: "Dev User" }) => {
    setRole(nextRole);
    setUser(nextUser);
  };

  const logout = () => {
    setRole(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      role,
      user,
      isAuthenticated: role !== null,
      login,
      logout,
    }),
    [role, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
