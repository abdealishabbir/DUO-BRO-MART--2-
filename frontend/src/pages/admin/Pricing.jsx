import { useEffect, useState } from "react";
import { RefreshCw, Check, X } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { inputClass } from "../../components/FormField.jsx";

function CommissionRatesCard({ rates, onSaved }) {
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const valueFor = (row) => edits[row.category_id] ?? row.rate_percent;

  const save = async () => {
    setSaving(true);
    setSaved(false);
    const payload = Object.entries(edits).map(([category_id, rate_percent]) => ({ category_id: Number(category_id), rate_percent }));
    if (payload.length > 0) {
      await api.patch("/products/admin/commission-rates/", { rates: payload });
    }
    setEdits({});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">Commission Rates by Category</h2>
        <button
          onClick={save}
          disabled={saving || Object.keys(edits).length === 0}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save Changes"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rates.map((row) => (
          <div key={row.category_id} className="rounded-md border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-700">{row.category_name}</p>
            <p className="mb-1 text-[10px] text-gray-400">{row.is_custom ? "Custom rate" : "Default rate — not yet customized"}</p>
            <div className="flex items-center gap-1">
              <input
                type="number" min="0" max="100" step="0.01"
                className={`${inputClass} w-24`}
                value={valueFor(row)}
                onChange={(e) => setEdits((prev) => ({ ...prev, [row.category_id]: e.target.value }))}
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangeRequestRow({ request, kind, onChanged }) {
  const [busy, setBusy] = useState(false);

  const decide = async (action) => {
    setBusy(true);
    try {
      const base = kind === "change" ? "/products/admin/change-requests/" : "/products/admin/stock-requests/";
      await api.post(`${base}${request.id}/${action}/`, {});
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-t border-gray-100 text-sm">
      <td className="p-2">
        <p className="font-medium text-gray-900">{request.product_name ?? request.product?.name}</p>
        <p className="text-xs text-gray-500">{request.vendor_name ?? request.vendor?.username}</p>
      </td>
      <td className="p-2 text-xs text-gray-600">
        {kind === "change" ? (
          <>
            {request.change_type === "price_change" && `New price: ${formatPKR(request.new_price)}`}
            {(request.change_type === "discount" || request.change_type === "flash_deal") && `Discount: ${request.discount_percent}%`}
            {request.change_type === "bogo" && "Enable BOGO"}
            {request.change_type === "gift_card_eligible" && "Enable Gift Card"}
          </>
        ) : (
          `+${request.requested_increase} units`
        )}
      </td>
      <td className="p-2">
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => decide("approve")} className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700">
            <Check className="h-3.5 w-3.5" /> Approve
          </button>
          <button disabled={busy} onClick={() => decide("reject")} className="flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-200">
            <X className="h-3.5 w-3.5" /> Reject
          </button>
        </div>
      </td>
    </tr>
  );
}

function RequestQueueCard({ title, requests, kind, onChanged }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-bold text-gray-900">{title} ({requests.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-gray-500">
            <tr>
              <th className="p-2">Product / Vendor</th>
              <th className="p-2">Requested Change</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={3} className="p-3 text-center text-gray-400">Nothing pending.</td></tr>
            ) : (
              requests.map((req) => <ChangeRequestRow key={req.id} request={req} kind={kind} onChanged={onChanged} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminPricing() {
  const [rates, setRates] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [stockRequests, setStockRequests] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [rateData, changeData, stockData, pricingData] = await Promise.all([
      api.get("/products/admin/commission-rates/"),
      api.get("/products/admin/change-requests/?status=pending"),
      api.get("/products/admin/stock-requests/?status=pending"),
      api.get("/products/admin/pricing/"),
    ]);
    setRates(rateData);
    setChangeRequests(changeData.results ?? changeData);
    setStockRequests(stockData.results ?? stockData);
    setPricing(pricingData.results ?? pricingData);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Pricing & Commission</h1>
        <button onClick={load} className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <CommissionRatesCard rates={rates} onSaved={load} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RequestQueueCard title="Pending Price/Deal Requests" requests={changeRequests} kind="change" onChanged={load} />
        <RequestQueueCard title="Pending Restock Requests" requests={stockRequests} kind="stock" onChanged={load} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-gray-900">Pricing Manager</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="p-2">Product</th>
                <th className="p-2">Vendor</th>
                <th className="p-2">Category</th>
                <th className="p-2">Sale Price</th>
                <th className="p-2">Commission %</th>
                <th className="p-2">Duo Bro Mart Earns</th>
                <th className="p-2">Vendor Receives</th>
                <th className="p-2">Stock</th>
              </tr>
            </thead>
            <tbody>
              {pricing.length === 0 ? (
                <tr><td colSpan={8} className="p-3 text-center text-gray-400">No products yet.</td></tr>
              ) : (
                pricing.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="p-2 font-medium text-gray-900">{row.name}</td>
                    <td className="p-2 text-gray-600">{row.vendor_name}</td>
                    <td className="p-2 text-gray-600">{row.category_name}</td>
                    <td className="p-2">{formatPKR(row.sale_price)}</td>
                    <td className="p-2">{row.commission_rate_percent}%</td>
                    <td className="p-2 text-red-600">{formatPKR(row.commission_amount)}</td>
                    <td className="p-2 font-semibold text-green-700">{formatPKR(row.base_price)}</td>
                    <td className="p-2">{row.stock_quantity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          To change a product's price directly, use the Products page — this table is read-only and reflects the category
          commission rates above.
        </p>
      </div>
    </div>
  );
}
