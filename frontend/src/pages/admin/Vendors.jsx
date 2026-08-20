import { useEffect, useState } from "react";
import { RefreshCw, Check, X, Image as ImageIcon } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { inputClass } from "../../components/FormField.jsx";
import { SkeletonTableRows } from "../../components/Skeleton.jsx";

function ApplicationRow({ application, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

  const approve = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/admin/vendor-applications/${application.id}/approve/`, {});
      onChanged();
    } catch (err) {
      setError(err.data?.detail || "Could not approve this application.");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/admin/vendor-applications/${application.id}/reject/`, { admin_notes: reason });
      onChanged();
    } catch (err) {
      setError(err.data?.detail || "Could not reject this application.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <tr className="border-t border-gray-100 text-sm">
        <td className="p-2">
          <p className="font-medium text-gray-900">{application.business_name}</p>
          <p className="text-xs text-gray-500">{application.business_type}</p>
        </td>
        <td className="p-2 text-xs text-gray-600">{application.owner_name}</td>
        <td className="p-2 text-xs text-gray-600">
          {new Date(application.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </td>
        <td className="p-2">
          {application.cnic_matches ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">CNIC Match</span>
          ) : (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">CNIC Mismatch</span>
          )}
        </td>
        <td className="p-2">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Pending</span>
        </td>
        <td className="p-2">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setExpanded((e) => !e)} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              {expanded ? "Hide" : "Review"}
            </button>
            <button disabled={busy} onClick={approve} className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700">
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
            <button disabled={busy} onClick={() => setShowReject((s) => !s)} className="flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-200">
              <X className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-t border-gray-100 bg-gray-50">
          <td colSpan={6} className="p-4">
            <div className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <p><span className="font-semibold text-gray-700">Email:</span> {application.email}</p>
              <p><span className="font-semibold text-gray-700">Phone:</span> {application.phone_number}</p>
              <p><span className="font-semibold text-gray-700">CNIC:</span> {application.cnic_number}</p>
              <p><span className="font-semibold text-gray-700">Bank:</span> {application.bank_name}</p>
              <p><span className="font-semibold text-gray-700">Account Title:</span> {application.account_title}</p>
              <p><span className="font-semibold text-gray-700">Account #:</span> {application.account_number}</p>
              <p><span className="font-semibold text-gray-700">Account CNIC:</span> {application.account_cnic}</p>
              {application.social_links && <p><span className="font-semibold text-gray-700">Social:</span> {application.social_links}</p>}
            </div>
            <p className="mt-3 text-xs text-gray-600">{application.description}</p>
            <div className="mt-3 flex gap-3">
              <a href={application.cnic_front} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                <ImageIcon className="h-3.5 w-3.5" /> CNIC Front
              </a>
              <a href={application.cnic_back} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                <ImageIcon className="h-3.5 w-3.5" /> CNIC Back
              </a>
            </div>
          </td>
        </tr>
      )}

      {showReject && (
        <tr className="border-t border-gray-100 bg-red-50/50">
          <td colSpan={6} className="p-3">
            <div className="flex items-center gap-2">
              <input
                className={`${inputClass} flex-1`}
                placeholder="Reason for rejection (e.g. CNIC mismatch)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button disabled={busy} onClick={reject} className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
                {busy ? "Rejecting..." : "Confirm Reject"}
              </button>
              {error && <span className="text-xs text-red-600">{error}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PayoutScheduleCell({ vendor, field, defaultDays, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(vendor[field] ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isOverride = vendor[field] !== null && vendor[field] !== undefined;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.patch(`/admin/vendors/${vendor.id}/payout-schedule/`, { [field]: value === "" ? null : Number(value) });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err.data?.detail || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    setSaving(true);
    setError("");
    try {
      await api.patch(`/admin/vendors/${vendor.id}/payout-schedule/`, { [field]: null });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err.data?.detail || "Couldn't reset.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(vendor[field] ?? ""); setEditing(true); }}
        className="text-left text-xs hover:underline"
        title="Click to edit"
      >
        {isOverride ? (
          <span className="font-semibold text-brand">{vendor[field]}d <span className="font-normal text-gray-400">(override)</span></span>
        ) : (
          <span className="text-gray-500">{defaultDays}d <span className="text-gray-400">(default)</span></span>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="0"
        max="90"
        className="w-14 rounded border border-gray-300 px-1.5 py-0.5 text-base"
        placeholder={String(defaultDays)}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button disabled={saving} onClick={save} className="rounded bg-brand px-1.5 py-0.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50">✓</button>
      {isOverride && (
        <button disabled={saving} onClick={resetToDefault} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-200">Reset</button>
      )}
      <button onClick={() => setEditing(false)} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-200">✕</button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

function VendorRow({ vendor, defaults, onChanged }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/vendors/${vendor.id}/suspend/`, { action: vendor.is_active ? "suspend" : "reactivate" });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-t border-gray-100 text-sm">
      <td className="p-2 font-medium text-gray-900">{vendor.business_name}</td>
      <td className="p-2 text-xs text-gray-600">{vendor.email}</td>
      <td className="p-2">{vendor.product_count}</td>
      <td className="p-2">{formatPKR(vendor.gross_sales)}</td>
      <td className="p-2 text-red-600">-{formatPKR(vendor.commission_earned)}</td>
      <td className="p-2 font-semibold text-green-700">{formatPKR(vendor.net_paid_out)}</td>
      <td className="p-2">
        <PayoutScheduleCell vendor={vendor} field="payout_hold_days_override" defaultDays={defaults.payout_hold_days} onChanged={onChanged} />
      </td>
      <td className="p-2">
        <PayoutScheduleCell vendor={vendor} field="payout_cycle_days_override" defaultDays={defaults.payout_cycle_days} onChanged={onChanged} />
      </td>
      <td className="p-2">
        {vendor.is_active ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Active</span>
        ) : (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Suspended</span>
        )}
      </td>
      <td className="p-2">
        <button
          disabled={busy}
          onClick={toggle}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
            vendor.is_active ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          {vendor.is_active ? "Suspend" : "Reactivate"}
        </button>
      </td>
    </tr>
  );
}

export default function AdminVendors() {
  const [applications, setApplications] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [defaults, setDefaults] = useState({ payout_hold_days: 3, payout_cycle_days: 7 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [apps, vendorList, settings] = await Promise.all([
      api.get("/admin/vendor-applications/?status=pending"),
      api.get("/admin/vendors/"),
      api.get("/settings/admin/"),
    ]);
    setApplications(apps.results ?? apps);
    setVendors(vendorList);
    setDefaults({ payout_hold_days: settings.payout_hold_days, payout_cycle_days: settings.payout_cycle_days });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Vendors</h1>
        <button onClick={load} className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold text-gray-900">Pending Applications ({applications.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="p-2">Business Name</th>
                <th className="p-2">Owner</th>
                <th className="p-2">Applied Date</th>
                <th className="p-2">CNIC Check</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows columns={6} rows={4} />
              ) : applications.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-sm text-gray-500">No pending applications.</td></tr>
              ) : (
                applications.map((app) => <ApplicationRow key={app.id} application={app} onChanged={load} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-bold text-gray-900">Active Vendors</h2>
        <p className="mb-3 text-xs text-gray-500">
          Payout Hold/Cycle columns are editable — click a value to give that vendor a faster (or slower) payout schedule than the platform default.
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="p-2">Business Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Products</th>
                <th className="p-2">Gross Sales</th>
                <th className="p-2">Commission Earned</th>
                <th className="p-2">Net Paid Out</th>
                <th className="p-2">Payout Hold</th>
                <th className="p-2">Payout Cycle</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows columns={10} rows={5} />
              ) : vendors.length === 0 ? (
                <tr><td colSpan={10} className="p-4 text-center text-sm text-gray-500">No vendors yet.</td></tr>
              ) : (
                vendors.map((vendor) => <VendorRow key={vendor.id} vendor={vendor} defaults={defaults} onChanged={load} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
