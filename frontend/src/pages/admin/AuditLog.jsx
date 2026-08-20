import { useEffect, useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import { api } from "../../lib/api.js";
import { SkeletonTable } from "../../components/Skeleton.jsx";

const ACTION_LABELS = {
  "product.approved": "Product Approved",
  "product.rejected": "Product Rejected",
  "product_change_request.approved": "Price/Deal Change Approved",
  "product_change_request.rejected": "Price/Deal Change Rejected",
  "stock_change_request.approved": "Stock Increase Approved",
  "stock_change_request.rejected": "Stock Increase Rejected",
  "vendor_application.approved": "Vendor Application Approved",
  "vendor_application.rejected": "Vendor Application Rejected",
  "vendor.suspended": "Vendor Suspended",
  "vendor.reinstated": "Vendor Reinstated",
  "vendor.payout_schedule_changed": "Vendor Payout Schedule Changed",
  "banner_application.approved": "Banner Application Approved",
  "banner_application.rejected": "Banner Application Rejected",
  "order.status_changed": "Order Status Changed",
  "payout.marked_paid": "Payout Marked Paid",
  "payout.retry_marked_paid": "Payout Retried & Marked Paid",
  "payout.marked_failed": "Payout Marked Failed (Reopened)",
};

const ACTION_COLORS = {
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-700",
  reinstated: "bg-green-100 text-green-700",
  changed: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

function badgeColor(action) {
  for (const [key, cls] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return cls;
  }
  return "bg-gray-100 text-gray-600";
}

export default function AdminAuditLog() {
  const [entries, setEntries] = useState(null);
  const [actionFilter, setActionFilter] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    api.get(`/admin/audit-log/?${params.toString()}`)
      .then((res) => setEntries(res.results ?? res))
      .catch(() => setError("Couldn't load the audit log."));
  };

  useEffect(load, [actionFilter]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-heading">Audit Log</h2>
          <p className="text-sm text-gray-500">Who approved, rejected, or changed what, and when.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm font-medium text-gray-600 hover:border-brand hover:text-brand">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="mt-4">
        <select className="rounded-md border border-gray-300 px-3 py-1.5 text-base" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-surface shadow-sm">
        {entries === null ? (
          <SkeletonTable columns={5} rows={6} />
        ) : entries.length === 0 ? (
          <div className="p-10 text-center">
            <ScrollText className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No admin actions logged yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">By</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-50 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeColor(e.action)}`}>
                      {ACTION_LABELS[e.action] || e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {e.target_repr || `${e.target_type} #${e.target_id}`}
                    <span className="ml-1 text-gray-400">({e.target_type})</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{e.actor_name}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-xs text-gray-500" title={e.details}>{e.details || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{new Date(e.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
