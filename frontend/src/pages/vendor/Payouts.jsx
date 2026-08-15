import { useEffect, useState } from "react";
import { RefreshCw, Wallet, Clock, Download } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { SkeletonTable, SkeletonStatCard } from "../../components/Skeleton.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function VendorPayouts() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    api.get("/orders/vendor/payouts/")
      .then(setData)
      .catch(() => setError("Couldn't load your payouts. Please refresh."));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Payouts</h2>
          <p className="text-sm text-gray-500">Your earnings from delivered orders, and every payout batch sent to you.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${API_BASE}/orders/vendor/payouts/export/`}
            download
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-brand hover:text-brand"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-brand hover:text-brand">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!data ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </div>
          <div className="mt-6 overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            <SkeletonTable columns={5} rows={5} />
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Accruing Balance</p>
              <p className="mt-1 text-lg font-bold text-amber-700">{formatPKR(data.pending_balance)}</p>
              <p className="mt-0.5 text-xs text-gray-400">{data.pending_item_count} delivered item{data.pending_item_count !== 1 ? "s" : ""} not yet batched</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Lifetime Paid</p>
              <p className="mt-1 text-lg font-bold text-green-700">{formatPKR(data.lifetime_paid)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-400"><Clock className="h-3.5 w-3.5" /> Next Batch Eligible</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {data.next_eligible_at ? new Date(data.next_eligible_at).toLocaleDateString() : "As soon as you have eligible earnings"}
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Delivered orders become payout-eligible a few days after delivery (covers the return window), then get batched together on a set cycle. No live bank transfer is connected yet — an admin sends the money and marks each batch paid here.
          </p>

          <div className="mt-6 overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            {data.payouts.length === 0 ? (
              <div className="p-10 text-center">
                <Wallet className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No payout batches yet — they&apos;ll appear here once your delivered earnings are batched.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payouts.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 text-xs text-gray-600">{p.period_start} → {p.period_end}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{p.items.length}</td>
                      <td className="px-4 py-3 font-medium text-green-700">{formatPKR(p.total_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                        {p.status === "failed" && p.failure_reason && (
                          <p className="mt-1 max-w-[220px] text-xs text-red-500">{p.failure_reason} — we&apos;ll retry this shortly.</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {p.status === "paid" && p.paid_at ? new Date(p.paid_at).toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
