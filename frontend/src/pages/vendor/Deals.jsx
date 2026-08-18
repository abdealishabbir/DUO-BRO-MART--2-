import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Percent, Plus, Info, X } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import FormField, { inputClass } from "../../components/FormField.jsx";
import { SkeletonTable } from "../../components/Skeleton.jsx";

const CHANGE_TYPES = [
  { value: "discount", label: "Discount %" },
  { value: "flash_deal", label: "Flash Deal (time-boxed)" },
  { value: "price_change", label: "Price Change" },
  { value: "bogo", label: "Buy One Get One" },
  { value: "gift_card_eligible", label: "Gift-Card Eligible" },
];

const STATUS_BADGE = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const EMPTY_FORM = { product: "", change_type: "discount", new_price: "", discount_percent: "", deal_starts_at: "", deal_ends_at: "", note: "" };

function RequestSummary({ request }) {
  switch (request.change_type) {
    case "price_change":
      return <span>New price: <strong>{formatPKR(request.new_price)}</strong></span>;
    case "discount":
      return <span><strong>{Number(request.discount_percent)}%</strong> off, ongoing</span>;
    case "flash_deal":
      return (
        <span>
          <strong>{Number(request.discount_percent)}%</strong> off, {new Date(request.deal_starts_at).toLocaleDateString()} - {new Date(request.deal_ends_at).toLocaleDateString()}
        </span>
      );
    case "bogo":
      return <span>Buy One Get One</span>;
    case "gift_card_eligible":
      return <span>Gift-card eligible</span>;
    default:
      return null;
  }
}

function NewRequestForm({ products, initialProductId, onDone, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, product: initialProductId ?? "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.product) {
      setError("Please select a product.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        product: Number(form.product),
        change_type: form.change_type,
        note: form.note,
      };
      if (form.change_type === "price_change") payload.new_price = Number(form.new_price);
      if (form.change_type === "discount" || form.change_type === "flash_deal") payload.discount_percent = Number(form.discount_percent);
      if (form.change_type === "flash_deal") {
        payload.deal_starts_at = new Date(form.deal_starts_at).toISOString();
        payload.deal_ends_at = new Date(form.deal_ends_at).toISOString();
      }
      await api.post("/products/vendor/change-requests/", payload);
      onDone();
    } catch (err) {
      setError(err.data?.detail || Object.values(err.data ?? {})[0]?.[0] || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-heading">New Pricing Request</h3>
        <button type="button" onClick={onCancel} aria-label="Close pricing request form" className="text-gray-400 hover:text-heading">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Changes only go live once an admin approves them (§6.3) — your product&apos;s current price stays as-is until then.</span>
        </div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <FormField label="Product *">
          <select className={inputClass} value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })}>
            <option value="" disabled>Select a live product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormField>

        <FormField label="Request Type *">
          <select className={inputClass} value={form.change_type} onChange={(e) => setForm({ ...form, change_type: e.target.value })}>
            {CHANGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </FormField>

        {form.change_type === "price_change" && (
          <FormField label="New Price (PKR) *">
            <input type="number" min="0" className={inputClass} value={form.new_price} onChange={(e) => setForm({ ...form, new_price: e.target.value })} />
          </FormField>
        )}

        {(form.change_type === "discount" || form.change_type === "flash_deal") && (
          <FormField label="Discount % *">
            <input type="number" min="1" max="90" className={inputClass} placeholder="e.g. 20" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
          </FormField>
        )}

        {form.change_type === "flash_deal" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Deal Starts *">
              <input type="datetime-local" className={inputClass} value={form.deal_starts_at} onChange={(e) => setForm({ ...form, deal_starts_at: e.target.value })} />
            </FormField>
            <FormField label="Deal Ends *">
              <input type="datetime-local" className={inputClass} value={form.deal_ends_at} onChange={(e) => setForm({ ...form, deal_ends_at: e.target.value })} />
            </FormField>
          </div>
        )}

        <FormField label="Note to Admin (optional)">
          <textarea className={`${inputClass} min-h-[70px] resize-y`} placeholder="Any context for the reviewer..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </FormField>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={saving} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-60">
          {saving ? "Submitting..." : "Submit Request"}
        </button>
      </form>
    </div>
  );
}

export default function VendorDeals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState(null);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(!!searchParams.get("product"));
  const [error, setError] = useState("");

  const load = () => {
    api.get("/products/vendor/change-requests/?page_size=100")
      .then((res) => setRequests(res.results ?? []))
      .catch(() => setError("Couldn't load your pricing requests. Please refresh."));
  };

  useEffect(() => {
    load();
    api.get("/products/vendor/products/?page_size=200")
      .then((res) => setProducts((res.results ?? []).filter((p) => p.status === "approved")))
      .catch(() => {});
  }, []);

  const closeForm = () => {
    setShowForm(false);
    searchParams.delete("product");
    setSearchParams(searchParams, { replace: true });
    load();
  };

  if (showForm) {
    return (
      <div>
        <button onClick={closeForm} className="mb-4 text-sm font-medium text-gray-500 hover:text-heading">← Back to Deals & Pricing</button>
        <NewRequestForm products={products} initialProductId={searchParams.get("product")} onDone={closeForm} onCancel={closeForm} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-heading">Deals & Pricing</h2>
          <p className="text-sm text-gray-500">Request discounts, flash deals, or price changes on your live products.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={products.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
          title={products.length === 0 ? "You need at least one approved (live) product first" : undefined}
        >
          <Plus className="h-4 w-4" /> New Request
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 rounded-xl border border-gray-100 bg-surface shadow-sm">
        {requests === null ? (
          <SkeletonTable columns={5} rows={5} />
        ) : requests.length === 0 ? (
          <div className="p-8 text-center">
            <Percent className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              No pricing requests yet.{" "}
              {products.length > 0 ? (
                <button onClick={() => setShowForm(true)} className="font-medium text-brand hover:underline">File your first one</button>
              ) : (
                "Get a product approved first, then come back here."
              )}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Filed</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-heading">{r.product_name}</td>
                  <td className="px-4 py-3 text-gray-600">{CHANGE_TYPES.find((t) => t.value === r.change_type)?.label}</td>
                  <td className="px-4 py-3 text-gray-600"><RequestSummary request={r} /></td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                    {r.status === "rejected" && r.admin_notes && <p className="mt-0.5 text-xs text-red-500">{r.admin_notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
