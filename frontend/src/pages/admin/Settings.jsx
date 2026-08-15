import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { inputClass } from "../../components/FormField.jsx";
import { Skeleton } from "../../components/Skeleton.jsx";

function SkeletonFormCard({ fields = 3 }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <Skeleton className="mb-3 h-4 w-36" />
      <div className="space-y-3">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-1.5 h-2.5 w-28" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-5 w-36" />
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonFormCard key={i} />
        ))}
      </div>
      <Skeleton className="h-10 w-36 rounded-md" />
    </div>
  );
}

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

function RecoveryCodesDisplay({ codes, onDone }) {
  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-800">Save these recovery codes now — they won&apos;t be shown again.</p>
      <p className="mt-0.5 text-[10px] text-amber-700">Each works once, if you ever lose access to your authenticator app.</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-xs text-ink">
        {codes.map((c) => <div key={c} className="rounded bg-white px-2 py-1 text-center">{c}</div>)}
      </div>
      <button onClick={onDone} className="mt-3 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-black">
        I&apos;ve saved these
      </button>
    </div>
  );
}

function MFASettingsCard() {
  const [status, setStatus] = useState(null); // { is_enabled }
  const [stage, setStage] = useState("idle"); // idle | setting_up | disabling
  const [qrDataUri, setQrDataUri] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/auth/admin/mfa/status/").then(setStatus).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const startSetup = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await api.post("/auth/admin/mfa/setup/", {});
      setSecret(res.secret);
      setQrDataUri(res.qr_code_data_uri);
      setStage("setting_up");
    } catch {
      setError("Couldn't start setup. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await api.post("/auth/admin/mfa/confirm/", { code });
      setRecoveryCodes(res.recovery_codes);
      setCode("");
    } catch (err) {
      setError(err.data?.detail || "Invalid code — check your authenticator app and try again.");
    } finally {
      setBusy(false);
    }
  };

  const finishAfterRecoveryCodes = () => {
    setRecoveryCodes(null);
    setQrDataUri(null);
    setSecret(null);
    setStage("idle");
    load();
  };

  const disable = async () => {
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/admin/mfa/disable/", { password, code });
      setStage("idle");
      setPassword("");
      setCode("");
      load();
    } catch (err) {
      setError(err.data?.detail || "Couldn't disable — check your password and code.");
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    const currentCode = window.prompt("Enter your current authenticator code or a recovery code to confirm:");
    if (!currentCode) return;
    setError("");
    try {
      const res = await api.post("/auth/admin/mfa/recovery-codes/regenerate/", { code: currentCode });
      setRecoveryCodes(res.recovery_codes);
    } catch (err) {
      setError(err.data?.detail || "Invalid code.");
    }
  };

  if (!status) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-bold text-gray-900">Security — Two-Factor Authentication</h2>

      {recoveryCodes ? (
        <RecoveryCodesDisplay codes={recoveryCodes} onDone={finishAfterRecoveryCodes} />
      ) : status.is_enabled ? (
        <>
          <p className="flex items-center gap-1.5 text-xs font-medium text-green-700">● Two-factor authentication is enabled</p>
          {stage !== "disabling" ? (
            <div className="mt-3 flex gap-2">
              <button onClick={regenerate} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-brand">
                Regenerate recovery codes
              </button>
              <button onClick={() => setStage("disabling")} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                Disable
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-[10px] text-gray-500">Confirm your password and current code to disable two-factor.</p>
              <input type="password" placeholder="Password" className={`${inputClass} text-xs`} value={password} onChange={(e) => setPassword(e.target.value)} />
              <input placeholder="123456 or recovery code" className={`${inputClass} text-xs`} value={code} onChange={(e) => setCode(e.target.value)} />
              <div className="flex gap-2">
                <button disabled={busy} onClick={disable} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                  {busy ? "Disabling..." : "Confirm Disable"}
                </button>
                <button onClick={() => { setStage("idle"); setPassword(""); setCode(""); setError(""); }} className="text-xs text-gray-500 hover:underline">Cancel</button>
              </div>
            </div>
          )}
        </>
      ) : stage === "idle" ? (
        <>
          <p className="text-xs text-gray-500">Not enabled. Optional — add an authenticator-app code as a second step at login.</p>
          <button disabled={busy} onClick={startSetup} className="mt-3 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-60">
            {busy ? "Starting..." : "Enable Two-Factor Authentication"}
          </button>
        </>
      ) : (
        <div className="mt-1 space-y-3">
          <p className="text-xs text-gray-600">Scan this with Google Authenticator, Authy, or similar:</p>
          {qrDataUri && <img src={qrDataUri} alt="MFA QR code" className="h-40 w-40 rounded-md border border-gray-200" />}
          <p className="text-xs text-gray-400">Can&apos;t scan? Enter this key manually: <span className="font-mono">{secret}</span></p>
          <input placeholder="Enter the 6-digit code" className={`${inputClass} text-xs`} value={code} onChange={(e) => setCode(e.target.value)} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={confirmSetup} className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-60">
              {busy ? "Confirming..." : "Confirm & Enable"}
            </button>
            <button onClick={() => { setStage("idle"); setQrDataUri(null); setSecret(null); setCode(""); setError(""); }} className="text-xs text-gray-500 hover:underline">Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
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

  if (!form) return <SettingsSkeleton />;

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
              <span className="mt-1 block text-[10px] text-gray-400">Covers the return/complaint window before a delivered order&apos;s earnings become payout-eligible.</span>
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
            All four alerts fire for real to your store email below. Delivery depends on SMTP being configured — without
            it, emails print to the backend console instead of reaching an inbox.
          </p>
        </div>

        <MFASettingsCard />
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
