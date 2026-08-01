import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { inputClass } from "../../components/FormField.jsx";

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-gray-300"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

export default function AdminSettings() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/settings/admin/").then(setForm);
  }, []);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.patch("/settings/admin/", form);
      setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <div className="p-6 text-sm text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Store Settings</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-900">General Settings</h2>
          <div className="space-y-3">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-700">Store Name</span>
              <input className={inputClass} value={form.store_name} onChange={(e) => set("store_name")(e.target.value)} />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-700">Store Email</span>
              <input type="email" className={inputClass} value={form.store_email} onChange={(e) => set("store_email")(e.target.value)} />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-700">Store Currency</span>
              <input className={inputClass} value={form.currency} disabled />
              <span className="mt-1 block text-[10px] text-gray-400">Duo Bro Mart is PKR-only for now.</span>
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-900">Shipping Settings</h2>
          <div className="space-y-3">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-700">Standard Shipping Rate (PKR)</span>
              <input type="number" className={inputClass} value={form.default_shipping_rate} onChange={(e) => set("default_shipping_rate")(e.target.value)} />
              <span className="mt-1 block text-[10px] text-gray-400">Express/Urgent tiers keep their own fixed rates (450/800) at checkout.</span>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-700">Free Shipping Threshold (PKR)</span>
              <input type="number" className={inputClass} value={form.free_shipping_threshold} onChange={(e) => set("free_shipping_threshold")(e.target.value)} />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-700">Handling Time</span>
              <select className={inputClass} value={form.handling_time} onChange={(e) => set("handling_time")(e.target.value)}>
                <option value="same_day">Same Day</option>
                <option value="1_2_days">1-2 Business Days</option>
                <option value="3_5_days">3-5 Business Days</option>
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-900">Payment Settings</h2>
          <div className="space-y-3">
            {[
              ["cod_enabled", "Cash on Delivery"],
              ["card_enabled", "Cards"],
              ["jazzcash_enabled", "JazzCash"],
              ["easypaisa_enabled", "EasyPaisa"],
            ].map(([field, label]) => (
              <div key={field} className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">{label}</span>
                <Toggle checked={form[field]} onChange={set(field)} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-900">Payout Schedule</h2>
          <div className="space-y-3">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-700">Hold Period (days after delivery)</span>
              <input type="number" min="0" className={inputClass} value={form.payout_hold_days} onChange={(e) => set("payout_hold_days")(e.target.value)} />
              <span className="mt-1 block text-[10px] text-gray-400">Covers the return/complaint window before a delivered order's earnings become payout-eligible.</span>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-gray-700">Payout Cycle (days)</span>
              <input type="number" min="1" className={inputClass} value={form.payout_cycle_days} onChange={(e) => set("payout_cycle_days")(e.target.value)} />
              <span className="mt-1 block text-[10px] text-gray-400">Minimum gap between payout batches for the same vendor.</span>
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-900">Email Notifications</h2>
          <div className="space-y-3">
            {[
              ["notify_new_orders", "New Orders"],
              ["notify_new_vendor_applications", "New Vendor Applications"],
              ["notify_low_stock", "Low Stock Alerts"],
              ["notify_payout_requests", "Payout Requests"],
            ].map(([field, label]) => (
              <div key={field} className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">{label}</span>
                <Toggle checked={form[field]} onChange={set(field)} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-gray-400">
            These flags are saved, but the actual admin-notification emails aren't wired up yet — that lands with Phase 7's
            real-time/notification work.
          </p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-ink px-6 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save Settings"}
      </button>
    </div>
  );
}
