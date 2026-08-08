import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../auth/AuthContext.jsx";
import FormField, { inputClass } from "../../components/FormField.jsx";
import GoogleSignInButton from "../../components/GoogleSignInButton.jsx";

export default function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectAfterLogin = () => {
    // §4.1: default redirect after customer login is the Shop page.
    const from = location.state?.from || "/shop";
    navigate(from, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password, keepLoggedIn);
      redirectAfterLogin();
    } catch (err) {
      setError(err.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredential = async (idToken) => {
    setError("");
    try {
      const result = await googleLogin(idToken);
      if (result.needs_phone_number) {
        navigate("/account", { state: { promptPhone: true } });
      } else {
        redirectAfterLogin();
      }
    } catch (err) {
      setError(err.data?.detail || "Google sign-in failed.");
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
      <p className="mt-1 text-sm text-gray-500">Welcome back to Duo Bro Mart.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <FormField label="Email">
          <input
            type="email"
            required
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </FormField>

        <FormField label="Password">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              className={`${inputClass} pr-10`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormField>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-gray-600">
            <input
              type="checkbox"
              checked={keepLoggedIn}
              onChange={(e) => setKeepLoggedIn(e.target.checked)}
            />
            Keep me logged in
          </label>
          <Link to="/forgot-password" className="text-brand hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="mt-6">
        <GoogleSignInButton onCredential={handleGoogleCredential} />
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-medium text-brand hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
