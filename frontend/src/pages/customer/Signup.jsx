import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import FormField, { inputClass } from "../../components/FormField.jsx";
import GoogleSignInButton from "../../components/GoogleSignInButton.jsx";

const PHONE_REGEX = /^(\+92|0)3\d{9}$/;

function passwordStrength(password) {
  if (!password) return { label: "", score: 0 };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ["Too weak", "Weak", "Okay", "Good", "Strong", "Very strong"];
  return { label: labels[score], score };
}

export default function Signup() {
  const { signup, googleLogin } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  const validate = () => {
    const errors = {};
    if (!fullName.trim()) errors.full_name = "Full name is required.";
    if (!PHONE_REGEX.test(phone)) errors.phone_number = "Enter a valid Pakistani number, e.g. 03001234567.";
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      errors.password = "Min 8 characters, with an uppercase letter, a lowercase letter, a number, and a symbol.";
    }
    if (password !== confirmPassword) errors.confirm_password = "Passwords do not match.";
    if (!termsAccepted) errors.terms_accepted = "You must agree to the Terms & Conditions.";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await signup({
        full_name: fullName,
        phone_number: phone,
        email,
        password,
        confirm_password: confirmPassword,
        terms_accepted: termsAccepted,
      });
      navigate("/shop", { replace: true });
    } catch (err) {
      if (err.data && typeof err.data === "object") {
        const backendErrors = {};
        Object.entries(err.data).forEach(([key, value]) => {
          backendErrors[key] = Array.isArray(value) ? value.join(" ") : String(value);
        });
        setFieldErrors((prev) => ({ ...prev, ...backendErrors }));
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredential = async (idToken) => {
    setFormError("");
    try {
      const result = await googleLogin(idToken);
      navigate(result.needs_phone_number ? "/account" : "/shop", { replace: true });
    } catch (err) {
      setFormError(err.data?.detail || "Google sign-in failed.");
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
      <p className="mt-1 text-sm text-gray-500">Join Duo Bro Mart in less than a minute.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <FormField label="Full name" error={fieldErrors.full_name}>
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>

        <FormField label="Phone number" error={fieldErrors.phone_number}>
          <input
            className={inputClass}
            placeholder="03001234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </FormField>

        <FormField label="Email" error={fieldErrors.email}>
          <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>

        <FormField label="Password" error={fieldErrors.password}>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {password && (
            <span className="mt-1 block text-xs text-gray-500">Strength: {strength.label}</span>
          )}
        </FormField>

        <FormField label="Confirm password" error={fieldErrors.confirm_password}>
          <input
            type="password"
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </FormField>

        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
          />
          <span>
            I agree to the{" "}
            <Link to="/terms" className="text-brand hover:underline">
              Terms & Conditions and Privacy Policy
            </Link>
          </span>
        </label>
        {fieldErrors.terms_accepted && <p className="text-sm text-red-600">{fieldErrors.terms_accepted}</p>}

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <div className="mt-6">
        <GoogleSignInButton onCredential={handleGoogleCredential} />
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
