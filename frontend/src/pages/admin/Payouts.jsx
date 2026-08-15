import { useEffect, Fragment, useState } from "react";
import { RefreshCw, Wallet, Download } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { inputClass } from "../../components/FormField.jsx";
import { SkeletonTable } from "../../components/Skeleton.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
];

function MarkPaidRow({ payout, onDone }) {
  const [reference, setReference] = useState(payout.reference || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isRetry = payout.status === "failed";

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await api.post(`/orders/admin/payouts/${payout.id}/mark-paid/`, { reference });
      onDone();
    } catch (err) {
      setError(err.data?.detail || "Couldn't mark this paid.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-gray-100 bg-blue-50/40">
      <td colSpan={7} className="p-4">
        {isRetry && payout.failure_reason && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="font-semibold">Previous attempt failed:</span> {payout.failure_reason}
            {payout.failed_at && <span className="text-red-500"> ({new Date(payout.failed_at).toLocaleDateString()})</span>}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Items in this batch</h4>
            <div className="mt-1 max-h-32 space-y-1 overflow-y-auto text-xs text-gray-600">
              {payout.items.map((i) => (
                <div key={i.id} className="flex justify-between">
                  <span>{i.order_code} — {i.quantity} × {i.product_name}</span>
                  <span className="font-medium text-green-700">{formatPKR(i.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-gray-700">Bank/Wallet Reference</span>
            <input className={`${inputClass} w-48`} placeholder="e.g. NayaPay TXN ID" value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
          <button onClick={submit} disabled={saving} className="rounded-md bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
            {saving ? "Saving..." : isRetry ? "Confirm Retry Paid" : "Confirm Paid"}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </td>
    </tr>
  );
}

function MarkFailedRow({ payout, onDone }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post(`/orders/admin/payouts/${payout.id}/mark-failed/`, { reason });
      onDone();
    } catch (err) {
      setError(err.data?.detail || "Couldn't reopen this payout.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-gray-100 bg-red-50/40">
      <td colSpan={7} className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <p className="w-full text-xs text-gray-600">
            This reopens the batch as <span className="font-semibold text-red-700">Failed</span> so it shows up under Pending/Failed again for a retry —
            use this if the transfer was marked Paid but actually never went through (wrong account number, bank rejected it, etc.).
          </p>
          <label className="flex-1 text-xs">
            <span className="mb-1 block font-medium text-gray-700">Why did it fail?</span>
            <input className={`${inputClass} w-full`} placeholder="e.g. Bank rejected — account number mismatch" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button onClick={submit} disabled={saving} className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {saving ? "Saving..." : "Confirm Reopen as Failed"}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </td>
    </tr>
  );
}

export default function AdminPayouts() {
  const [statusFilter, setStatusFilter] = useState("");
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState("");
  const [markingId, setMarkingId] = useState(null);
  const [failingId, setFailingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await api.get(`/orders/admin/payouts/?${params.toString()}`);
    setPayouts(res.results ?? res);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const generate = async () => {
    setGenerating(true);
    setGenerateMsg("");
    try {
      const res = await api.post("/orders/admin/payouts/generate/", {});
      setGenerateMsg(
        res.created_count === 0
          ? "No new payouts — nothing eligible right now (still inside the hold period, or a vendor's cycle cooldown hasn't passed)."
          : `Generated ${res.created_count} new payout${res.created_count !== 1 ? "s" : ""}.`
      );
      load();
    } catch {
      setGenerateMsg("Couldn't generate payouts.");
    } finally {
      setGenerating(false);
    }
  };

  const totalPending = payouts.filter((p) => p.status !== "paid").reduce((s, p) => s + Number(p.total_amount), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Payouts</h2>
          <p className="text-sm text-gray-500">Vendor earnings ledger — no live bank transfer is wired up, so batches are marked paid manually once you&apos;ve actually sent the money.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${API_BASE}/orders/admin/export/payouts/`}
            download
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-brand hover:text-brand"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-brand hover:text-brand">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={generate} disabled={generating} className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
            <Wallet className="h-4 w-4" /> {generating ? "Generating..." : "Generate Payouts"}
          </button>
        </div>
      </div>

      {generateMsg && <p className="mt-2 text-sm text-gray-600">{generateMsg}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Batches (filtered view)</p>
          <p className="mt-1 text-lg font-bold text-ink">{payouts.length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Owed (not yet paid)</p>
          <p className="mt-1 text-lg font-bold text-amber-700">{formatPKR(totalPending)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value || "all"}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${
              statusFilter === tab.value ? "bg-brand text-white" : "border border-gray-300 text-gray-600 hover:border-brand"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <SkeletonTable columns={7} rows={5} />
        ) : payouts.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-500">
            No payout batches yet. Click &quot;Generate Payouts&quot; once vendors have delivered orders past the hold period.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{p.vendor_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.period_start} → {p.period_end}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.items.length}</td>
                    <td className="px-4 py-3 font-medium text-green-700">{formatPKR(p.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                      {p.status === "paid" && p.reference && <span className="ml-1.5 text-xs text-gray-400">({p.reference})</span>}
                      {p.status === "failed" && p.failure_reason && (
                        <span className="ml-1.5 block max-w-[180px] truncate text-xs text-red-500" title={p.failure_reason}>{p.failure_reason}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.status !== "paid" && (
                        <button
                          onClick={() => { setFailingId(null); setMarkingId(markingId === p.id ? null : p.id); }}
                          className="text-xs font-medium text-brand hover:underline"
                        >
                          {markingId === p.id ? "Cancel" : p.status === "failed" ? "Retry Payment" : "Mark Paid"}
                        </button>
                      )}
                      {p.status === "paid" && (
                        <button
                          onClick={() => { setMarkingId(null); setFailingId(failingId === p.id ? null : p.id); }}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          {failingId === p.id ? "Cancel" : "Mark Failed"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {markingId === p.id && (
                    <MarkPaidRow payout={p} onDone={() => { setMarkingId(null); load(); }} />
                  )}
                  {failingId === p.id && (
                    <MarkFailedRow payout={p} onDone={() => { setFailingId(null); load(); }} />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
