import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until the initial /account/me/ check resolves

  // On first mount, check whether we already have a valid session (cookie
  // survives a page refresh — that's the point of using cookies over
  // in-memory state). Fails silently (401) if there's no session yet.
  useEffect(() => {
    api
      .get("/account/me/")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password, keepLoggedIn = false) => {
    const data = await api.post("/auth/login/", { email, password, keep_logged_in: keepLoggedIn });
    setUser(data.user);
    return data.user;
  };

  const vendorLogin = async (email, password) => {
    const data = await api.post("/auth/vendor/login/", { email, password });
    setUser(data.user);
    return data.user;
  };

  const adminLogin = async (email, password) => {
    const data = await api.post("/auth/admin/login/", { email, password });
    if (data.mfa_required) return data; // { mfa_required: true, mfa_token } — no session yet, see adminMfaVerify
    setUser(data.user);
    return data.user;
  };

  const adminMfaVerify = async (mfaToken, code) => {
    const data = await api.post("/auth/admin/mfa/verify/", { mfa_token: mfaToken, code });
    setUser(data.user);
    return data.user;
  };

  const googleLogin = async (idToken) => {
    const data = await api.post("/auth/google/", { id_token: idToken });
    setUser(data.user);
    return data;
  };

  const signup = async (payload) => {
    const data = await api.post("/auth/signup/", payload);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout/");
    } finally {
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const data = await api.get("/account/me/");
    setUser(data);
    return data;
  };

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: !!user,
      loading,
      login,
      vendorLogin,
      adminLogin,
      adminMfaVerify,
      googleLogin,
      signup,
      logout,
      refreshUser,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
