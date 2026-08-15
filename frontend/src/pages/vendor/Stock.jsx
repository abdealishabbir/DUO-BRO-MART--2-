import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Boxes, Plus, Info } from "lucide-react";
import { api } from "../../lib/api.js";
import FormField, { inputClass } from "../../components/FormField.jsx";
import { SkeletonTable } from "../../components/Skeleton.jsx";

const STATUS_BADGE = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function NewStockRequestForm({ products, initialProductId, onDone }) {
  const [productId, setProductId] = useState(initialProductId ?? "");
  const [increase, setIncrease] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find((p) => String(p.id) === String(productId));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!productId || !increase || Number(increase) < 1) {
      setError("Please select a product and enter a valid restock quantity.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/products/vendor/stock-requests/", {
        product: Number(productId),
        requested_increase: Number(increase),
        note,
      });
      onDone();
    } catch (err) {
      setError(err.data?.detail || Object.values(err.data ?? {})[0]?.[0] || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-ink">New Restock Request</h3>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Stock increases need admin approval before they reflect on your listing (§6.5). Stock still sells down normally in the meantime.</span>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <FormField label="Product *">
          <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="" disabled>Select a product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (currently {p.stock_quantity} in stock)</option>)}
          </select>
        </FormField>

        <FormField label="Additional Units *">
          <input type="number" min="1" className={inputClass} placeholder="e.g. 50" value={increase} onChange={(e) => setIncrease(e.target.value)} />
          {selectedProduct && increase && Number(increase) > 0 && (
            <p className="mt-1 text-xs text-gray-400">
              {selectedProduct.stock_quantity} + {increase} = {selectedProduct.stock_quantity + Number(increase)} units, once approved.
            </p>
          )}
        </FormField>

        <FormField label="Note (optional)">
          <textarea className={`${inputClass} min-h-[70px] resize-y`} placeholder="New shipment arriving, restocked from supplier, etc." value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={saving} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-60">
          {saving ? "Submitting..." : "Submit Request"}
        </button>
      </form>
    </div>
  );
}

export default function VendorStock() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState(null);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(!!searchParams.get("product"));
  const [error, setError] = useState("");

  const load = () => {
    api.get("/products/vendor/stock-requests/?page_size=100")
      .then((res) => setRequests(res.results ?? []))
      .catch(() => setError("Couldn't load your stock requests. Please refresh."));
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
        <button onClick={closeForm} className="mb-4 text-sm font-medium text-gray-500 hover:text-ink">← Back to Stock Requests</button>
        <NewStockRequestForm products={products} initialProductId={searchParams.get("product")} onDone={closeForm} onCancel={closeForm} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Stock Requests</h2>
          <p className="text-sm text-gray-500">Restock increases need admin approval — track their status here.</p>
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

      <div className="mt-5 rounded-xl border border-gray-100 bg-white shadow-sm">
        {requests === null ? (
          <SkeletonTable columns={5} rows={5} />
        ) : requests.length === 0 ? (
          <div className="p-8 text-center">
            <Boxes className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              No stock requests yet.{" "}
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
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Filed</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{r.product_name}</td>
                  <td className="px-4 py-3 text-gray-600">+{r.requested_increase} units</td>
                  <td className="max-w-xs truncate px-4 py-3 text-gray-500">{r.note || "—"}</td>
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
