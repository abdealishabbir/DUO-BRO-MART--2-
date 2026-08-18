import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../auth/AuthContext.jsx";
import Button from "../../components/Button.jsx";

// §4.1/§4.3: hidden, unadvertised URL. No self-signup — credentials are
// issued by admin after the vendor application is approved (Phase 6).
export default function VendorLogin() {
  const { vendorLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await vendorLogin(email, password);
      navigate(user.must_change_password ? "/vendor/change-password" : "/vendor/dashboard", { replace: true });
    } catch (err) {
      setError(err.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white">
            <Store className="h-6 w-6" />
          </span>
          <p className="mt-3 text-lg font-bold text-heading">Duo Bro Mart</p>
          <p className="text-xs font-medium text-brand">Vendor Portal</p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-surface p-6 shadow-sm">
          <h1 className="text-xl font-bold text-heading">Vendor Sign In</h1>
          <p className="mt-1 text-sm text-gray-500">Use the credentials emailed to you after approval.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-cream/60 px-3 py-2.5 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
                <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                <input
                  type="email" required
                  className="w-full bg-transparent text-sm text-heading outline-none placeholder:text-gray-400"
                  placeholder="you@yourstore.pk"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Password</span>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-cream/60 px-3 py-2.5 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
                <Lock className="h-4 w-4 shrink-0 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"} required
                  className="w-full bg-transparent text-sm text-heading outline-none placeholder:text-gray-400"
                  placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="shrink-0 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <Button type="submit" loading={submitting} loadingText="Signing in..." fullWidth>
              Sign In
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-gray-400">
          Not a vendor yet?{" "}
          <a href="/become-a-vendor" className="font-medium text-brand hover:underline">
            Apply to sell on Duo Bro Mart
          </a>
        </p>
      </div>
    </div>
  );
}
