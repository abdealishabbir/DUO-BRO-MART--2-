import { useEffect, useState } from "react";
import { RefreshCw, Check, X, Upload, Ban } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { inputClass } from "../../components/FormField.jsx";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
  awaiting_payment: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  live: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  overdue: "bg-red-100 text-red-700",
  suspended: "bg-red-200 text-red-900",
};

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status] || "bg-gray-100 text-gray-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function SettingsPanel({ settings, onSaved }) {
  const [price, setPrice] = useState(settings.banner_price_per_day);
  const [limit, setLimit] = useState(settings.carousel_slot_limit);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await api.patch("/banners/admin/settings/", {
      banner_price_per_day: price,
      carousel_slot_limit: limit,
    });
    onSaved();
    setSaving(false);
    setSaved(true);
  };

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">Price per day (Rs.)</span>
        <input type="number" min={0} className={`${inputClass} w-32`} value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">Carousel slot limit</span>
        <input type="number" min={1} max={20} className={`${inputClass} w-28`} value={limit} onChange={(e) => setLimit(e.target.value)} />
      </label>
      <button type="submit" disabled={saving} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
        {saving ? "Saving..." : "Save settings"}
      </button>
      {saved && <span className="text-sm text-green-600">Saved — applies immediately to vendors.</span>}
    </form>
  );
}

function PendingApplications({ applications, onDecided }) {
  const [busyId, setBusyId] = useState(null);

  const decide = async (id, action) => {
    setBusyId(id);
    await api.post(`/banners/admin/applications/${id}/${action}/`, {});
    setBusyId(null);
    onDecided();
  };

  if (applications.length === 0) return <p className="text-sm text-gray-500">No pending requests.</p>;

  return (
    <div className="space-y-2">
      {applications.map((app) => (
        <div key={app.id} className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-3">
            <img src={app.image} alt="" className="h-12 w-20 rounded object-cover" />
            <div className="text-sm">
              <p className="font-medium text-gray-900">{app.headline}</p>
              <p className="text-xs text-gray-500">
                {app.vendor_name} ({app.vendor_email}) · {app.requested_days}d · {app.payment_type} · {formatPKR(app.total_price)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              disabled={busyId === app.id}
              onClick={() => decide(app.id, "approve")}
              className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
            <button
              disabled={busyId === app.id}
              onClick={() => decide(app.id, "reject")}
              className="flex items-center gap-1 rounded-md bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
            >
              <X className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PublishForm({ application, slotLimit, onPublished, onCancel }) {
  const [slot, setSlot] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const publish = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const formData = new FormData();
    formData.append("application_id", application.id);
    formData.append("slot_position", slot);
    try {
      await api.postForm("/banners/admin/publish/", formData);
      onPublished();
    } catch (err) {
      setError(err.data?.detail || "Could not publish.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={publish} className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
      <img src={application.image} alt="" className="h-10 w-16 rounded object-cover" />
      <span className="font-medium text-gray-900">{application.headline}</span>
      <select required className={`${inputClass} w-28`} value={slot} onChange={(e) => setSlot(e.target.value)}>
        <option value="">Slot #</option>
        {Array.from({ length: slotLimit }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>Slot {n}</option>
        ))}
      </select>
      <button type="submit" disabled={submitting} className="flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">
        <Upload className="h-3.5 w-3.5" /> Publish
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:underline">Later</button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}

function ApprovedAwaitingPublish({ applications, slotLimit, onPublished }) {
  const [publishingId, setPublishingId] = useState(null);
  const unpublished = applications.filter((a) => !a.has_banner);

  if (unpublished.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Approved — ready to publish</h2>
      <div className="space-y-2">
        {unpublished.map((app) =>
          publishingId === app.id ? (
            <PublishForm
              key={app.id}
              application={app}
              slotLimit={slotLimit}
              onPublished={() => { setPublishingId(null); onPublished(); }}
              onCancel={() => setPublishingId(null)}
            />
          ) : (
            <div key={app.id} className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-3 text-sm">
              <div className="flex items-center gap-3">
                <img src={app.image} alt="" className="h-10 w-16 rounded object-cover" />
                <span className="font-medium text-gray-900">{app.headline}</span>
                <span className="text-xs text-gray-500">{app.vendor_name} · {app.payment_type}</span>
              </div>
              <button onClick={() => setPublishingId(app.id)} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">
                Publish...
              </button>
            </div>
          )
        )}
      </div>
    </section>
  );
}

function RecordPaymentForm({ bannerId, onRecorded }) {
  const [amount, setAmount] = useState("");
  const [open, setOpen] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    await api.post(`/banners/admin/banners/${bannerId}/record-payment/`, { amount });
    setAmount("");
    setOpen(false);
    onRecorded();
  };

  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-xs font-medium text-brand hover:underline">Record payment</button>;
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <input
        type="number" min={1} required
        className="w-20 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
        value={amount} onChange={(e) => setAmount(e.target.value)}
      />
      <button type="submit" className="rounded bg-brand px-2 py-0.5 text-xs font-semibold text-white">Save</button>
    </form>
  );
}

function LiveBannersTable({ banners, onChanged }) {
  const suspend = async (id) => {
    if (!window.confirm("Suspend this vendor's account? This blocks their login immediately.")) return;
    await api.post(`/banners/admin/banners/${id}/suspend/`, {});
    onChanged();
  };

  if (banners.length === 0) return <p className="text-sm text-gray-500">No published banners yet.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="p-2">Banner</th>
            <th className="p-2">Vendor</th>
            <th className="p-2">Slot</th>
            <th className="p-2">Status</th>
            <th className="p-2">Dates</th>
            <th className="p-2">Price</th>
            <th className="p-2">Paid</th>
            <th className="p-2">Penalty</th>
            <th className="p-2">Remaining</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {banners.map((b) => (
            <tr key={b.id} className="border-t border-gray-100">
              <td className="flex items-center gap-2 p-2">
                <img src={b.image} alt="" className="h-8 w-12 rounded object-cover" />
                {b.headline}
              </td>
              <td className="p-2">{b.vendor_name}</td>
              <td className="p-2">#{b.slot_position}</td>
              <td className="p-2"><StatusBadge status={b.status} /></td>
              <td className="p-2 whitespace-nowrap text-gray-500">
                {b.live_start_date ? (
                  <>{b.live_start_date} → {b.live_end_date}</>
                ) : (
                  <span className="italic">not scheduled yet</span>
                )}
              </td>
              <td className="p-2">{formatPKR(b.total_price)}</td>
              <td className="p-2 text-green-700">{formatPKR(b.paid_amount)}</td>
              <td className="p-2 text-red-600">{formatPKR(b.penalty_amount)}</td>
              <td className="p-2 font-semibold text-brand">{formatPKR(b.remaining_amount)}</td>
              <td className="p-2">
                <div className="flex items-center gap-2">
                  {b.remaining_amount > 0 && <RecordPaymentForm bannerId={b.id} onRecorded={onChanged} />}
                  {["overdue", "live"].includes(b.status) && b.remaining_amount > 0 && (
                    <button onClick={() => suspend(b.id)} className="flex items-center gap-0.5 text-xs text-red-600 hover:underline">
                      <Ban className="h-3 w-3" /> Suspend
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminBannersPromotion() {
  const [settings, setSettings] = useState(null);
  const [applications, setApplications] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    const [settingsData, applicationsData, bannersData] = await Promise.all([
      api.get("/banners/admin/settings/"),
      api.get("/banners/admin/applications/"),
      api.get("/banners/admin/banners/"),
    ]);
    setSettings(settingsData);
    setApplications(applicationsData.results ?? applicationsData);
    setBanners(bannersData.results ?? bannersData);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !settings) return <div className="p-6 text-sm text-gray-500">Loading...</div>;

  const pending = applications.filter((a) => a.status === "pending");
  const approved = applications.filter((a) => a.status === "approved");

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Banners &amp; Promotion</h1>
        <button onClick={loadAll} className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <SettingsPanel settings={settings} onSaved={loadAll} />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Pending requests</h2>
        <PendingApplications applications={pending} onDecided={loadAll} />
      </section>

      <ApprovedAwaitingPublish applications={approved} slotLimit={settings.carousel_slot_limit} onPublished={loadAll} />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Published banners &amp; payment status</h2>
        <LiveBannersTable banners={banners} onChanged={loadAll} />
      </section>
    </div>
  );
}
