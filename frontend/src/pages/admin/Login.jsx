import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Lock, Mail, KeyRound, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../auth/AuthContext.jsx";

// §4.1/§4.3/§8.1: hidden, unadvertised URL, provisioned manually (no
// signup). Styled dark (bg-ink) to match the admin panel shell itself
// (AdminLayout) rather than the lighter cream vendor/customer theme — a
// visual cue that this is the higher-privilege portal. TOTP two-factor is
// opt-in per admin (Settings → Security) — this page's second screen only
// appears for an admin who has actually turned it on.
export default function AdminLogin() {
  const { adminLogin, adminMfaVerify } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaToken, setMfaToken] = useState(null); // set once password step returns mfa_required
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await adminLogin(email, password);
      if (result?.mfa_required) {
        setMfaToken(result.mfa_token);
      } else {
        navigate("/admin/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await adminMfaVerify(mfaToken, code);
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <p className="mt-3 text-lg font-bold text-white">Duo Bro Mart</p>
          <p className="text-xs font-medium text-brand">Admin Panel</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-sm backdrop-blur">
          {mfaToken === null ? (
            <>
              <h1 className="text-xl font-bold text-white">Admin Sign In</h1>
              <p className="mt-1 text-sm text-gray-400">Restricted access — authorized administrators only.</p>

              <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-300">Email</span>
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
                    <Mail className="h-4 w-4 shrink-0 text-gray-500" />
                    <input
                      type="email" required
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                      placeholder="you@duobromart.pk"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-300">Password</span>
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
                    <Lock className="h-4 w-4 shrink-0 text-gray-500" />
                    <input
                      type={showPassword ? "text" : "password"} required
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                      placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="shrink-0 text-gray-500 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-60"
                >
                  {submitting ? "Signing in..." : "Sign In"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white">Two-Factor Verification</h1>
              <p className="mt-1 text-sm text-gray-400">Enter the 6-digit code from your authenticator app, or a recovery code.</p>

              <form onSubmit={handleCodeSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-300">Code</span>
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
                    <KeyRound className="h-4 w-4 shrink-0 text-gray-500" />
                    <input
                      required
                      className="w-full bg-transparent text-sm tracking-widest text-white outline-none placeholder:text-gray-500 placeholder:tracking-normal"
                      placeholder="123456 or xxxx-xxxx"
                      value={code} onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                </label>

                {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-60"
                >
                  {submitting ? "Verifying..." : "Verify"}
                </button>

                <button
                  type="button"
                  onClick={() => { setMfaToken(null); setCode(""); setError(""); }}
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-300"
                >
                  ← Back to sign in
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-gray-500">
          This portal is not linked from the public site.
        </p>
      </div>
    </div>
  );
}
