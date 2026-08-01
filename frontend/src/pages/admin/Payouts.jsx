import { useEffect, Fragment, useState } from "react";
import { RefreshCw, Wallet } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { inputClass } from "../../components/FormField.jsx";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
};

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
];

function MarkPaidRow({ payout, onDone }) {
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
            {saving ? "Saving..." : "Confirm Paid"}
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
          <p className="text-sm text-gray-500">Vendor earnings ledger — no live bank transfer is wired up, so batches are marked paid manually once you've actually sent the money.</p>
        </div>
        <div className="flex items-center gap-2">
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
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Owed (pending + processing)</p>
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
          <p className="p-6 text-sm text-gray-400">Loading...</p>
        ) : payouts.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-500">
            No payout batches yet. Click "Generate Payouts" once vendors have delivered orders past the hold period.
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
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {p.status !== "paid" && (
                        <button
                          onClick={() => setMarkingId(markingId === p.id ? null : p.id)}
                          className="text-xs font-medium text-brand hover:underline"
                        >
                          {markingId === p.id ? "Cancel" : "Mark Paid"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {markingId === p.id && (
                    <MarkPaidRow payout={p} onDone={() => { setMarkingId(null); load(); }} />
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
