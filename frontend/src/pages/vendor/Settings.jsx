import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, FileText } from "lucide-react";
import { api } from "../../lib/api.js";
import FormField, { inputClass } from "../../components/FormField.jsx";

const NOTIFICATION_DEFAULTS = [
  { key: "new_order", label: "New Order Received", desc: "Get notified when a customer places an order.", enabled: true },
  { key: "low_stock", label: "Low Stock Alerts", desc: "Alert when any product drops below 10 units.", enabled: true },
  { key: "product_review", label: "Product Review Updates", desc: "Get notified when admin approves or rejects a product.", enabled: true },
];

export default function VendorSettings() {
  const [form, setForm] = useState({ first_name: "", last_name: "", phone_number: "", email: "" });
  const [notifications, setNotifications] = useState(NOTIFICATION_DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/account/me/").then((user) => {
      setForm({ first_name: user.first_name ?? "", last_name: user.last_name ?? "", phone_number: user.phone_number ?? "", email: user.email });
    }).catch(() => setError("Couldn't load your account details."));
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await api.patch("/account/me/", { first_name: form.first_name, last_name: form.last_name, phone_number: form.phone_number });
      setSaved(true);
    } catch (err) {
      setError(err.data?.detail || "Couldn't save changes. Please check your details and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-ink">Contact Information</h3>
        <form onSubmit={saveProfile} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First Name">
              <input className={inputClass} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </FormField>
            <FormField label="Last Name">
              <input className={inputClass} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Phone Number">
            <input className={inputClass} value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
          </FormField>
          <FormField label="Email">
            <input className={`${inputClass} bg-gray-50 text-gray-500`} value={form.email} disabled />
          </FormField>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-700">Saved.</p>}

          <button type="submit" disabled={saving} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-60">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-ink">Commission & Terms</h3>
        <p className="mt-2 text-sm text-gray-600">
          Current platform commission: <strong className="text-ink">10%</strong> (provisional flat rate — category-based rates land with Admin Settings, §7.7).
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link to="/vendor/change-password" className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <KeyRound className="h-4 w-4" /> Change Password
          </Link>
          <Link to="/vendor-terms" className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <FileText className="h-4 w-4" /> Read Vendor Terms & Conditions
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-ink">Notifications</h3>
        <p className="mt-1 text-xs text-gray-400">Preferences shown here aren't saved to your account yet — this is a preview of the upcoming settings.</p>
        <div className="mt-3 space-y-3">
          {notifications.map((n) => (
            <div key={n.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">{n.label}</p>
                <p className="text-xs text-gray-400">{n.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifications((ns) => ns.map((x) => (x.key === n.key ? { ...x, enabled: !x.enabled } : x)))}
                className={`h-5 w-9 shrink-0 rounded-full transition-colors ${n.enabled ? "bg-brand" : "bg-gray-300"}`}
              >
                <span className={`block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${n.enabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
