import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../../lib/api.js";
import { inputClass } from "../../components/FormField.jsx";

const STATUS_TABS = [
  ["", "All"], ["open", "Open"], ["under_review", "Under Review"],
  ["resolved_refund", "Refunded"], ["resolved_replacement", "Replaced"], ["rejected", "Rejected"],
];

const STATUS_STYLES = {
  open: "bg-red-100 text-red-700", under_review: "bg-amber-100 text-amber-700",
  resolved_refund: "bg-green-100 text-green-700", resolved_replacement: "bg-green-100 text-green-700",
  rejected: "bg-gray-100 text-gray-600",
};

function ComplaintRow({ complaint, onChanged }) {
  const [status, setStatus] = useState(complaint.status);
  const [notes, setNotes] = useState(complaint.resolution_notes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await api.patch(`/complaints/admin/${complaint.id}/`, { status, resolution_notes: notes });
    setSaving(false);
    onChanged();
  };

  return (
    <tr className="border-t border-gray-100 text-sm align-top">
      <td className="p-2">
        <p className="font-medium text-gray-900">{complaint.product_name}</p>
        <p className="text-xs text-gray-500">#{complaint.order_code} · {complaint.customer_email} · Vendor: {complaint.vendor_name ?? "—"}</p>
      </td>
      <td className="p-2 text-xs capitalize text-gray-700">{complaint.reason.replaceAll("_", " ")}</td>
      <td className="p-2 max-w-xs text-xs text-gray-600">{complaint.description}</td>
      <td className="p-2">
        <select className={`${inputClass} w-40`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_TABS.filter(([v]) => v).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <textarea
          className={`${inputClass} mt-1 w-40 min-h-[50px]`}
          placeholder="Resolution notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button onClick={save} disabled={saving} className="mt-1 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark">
          {saving ? "Saving..." : "Save"}
        </button>
      </td>
      <td className="p-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[complaint.status] || "bg-gray-100 text-gray-600"}`}>
          {complaint.status.replaceAll("_", " ")}
        </span>
      </td>
    </tr>
  );
}

export default function AdminComplaints() {
  const [statusFilter, setStatusFilter] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const params = statusFilter ? `?status=${statusFilter}` : "";
    const data = await api.get(`/complaints/admin/${params}`);
    setComplaints(data.results ?? data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Complaints</h1>
        <button onClick={load} className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
        {STATUS_TABS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`rounded px-3 py-1.5 text-xs font-semibold ${statusFilter === value ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-2">Item / Order</th>
              <th className="p-2">Reason</th>
              <th className="p-2">Description</th>
              <th className="p-2">Resolve</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-4 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : complaints.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-sm text-gray-500">No complaints match this filter.</td></tr>
            ) : (
              complaints.map((c) => <ComplaintRow key={c.id} complaint={c} onChanged={load} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
