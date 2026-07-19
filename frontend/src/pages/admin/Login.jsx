import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import FormField, { inputClass } from "../../components/FormField.jsx";

// §4.1/§4.3: hidden, unadvertised URL, provisioned manually (no signup).
// TOTP two-factor is a Phase 8 hardening item — flagged, not silently skipped.
export default function AdminLogin() {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await adminLogin(email, password);
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-bold text-gray-900">Admin sign in</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <FormField label="Email">
          <input type="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Password">
          <input type="password" required className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
