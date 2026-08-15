import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import FormField, { inputClass } from "../../components/FormField.jsx";

// §2.4/§4.3: forced first-login password change for admin-provisioned vendor accounts.
export default function VendorChangePassword() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/\d/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      setError("Min 8 characters, with an uppercase letter, a lowercase letter, a number, and a symbol.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/account/change-password/", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      await refreshUser();
      navigate("/vendor/dashboard", { replace: true });
    } catch (err) {
      setError(err.data?.detail || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-xl font-bold text-gray-900">Set a new password</h1>
      <p className="mt-1 text-sm text-gray-500">
        For security, you need to change your temporary password before continuing.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <FormField label="Temporary password">
          <input type="password" required className={inputClass} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </FormField>
        <FormField label="New password">
          <input type="password" required className={inputClass} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </FormField>
        <FormField label="Confirm new password">
          <input type="password" required className={inputClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </FormField>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Save and continue"}
        </button>
      </form>
    </div>
  );
}
