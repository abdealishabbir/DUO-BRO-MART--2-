import { useEffect, useState } from "react";
import { RefreshCw, Check, X, Pencil, Trash2, Search } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { inputClass } from "../../components/FormField.jsx";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
];

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function EditProductForm({ product, categories, onSaved, onCancel }) {
  const [form, setForm] = useState({
    category: product.category,
    name: product.name,
    sku: product.sku || "",
    brand: product.brand,
    description: product.description,
    base_price: product.base_price,
    stock_quantity: product.stock_quantity,
    is_active: product.is_active,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.patch(`/products/admin/products/${product.id}/`, form);
      onSaved();
    } catch (err) {
      setError(err.data?.detail || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-gray-100 bg-blue-50/40">
      <td colSpan={8} className="p-3">
        <form onSubmit={save} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-gray-700">Name</span>
            <input className={inputClass} value={form.name} onChange={set("name")} required />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-gray-700">Brand</span>
            <input className={inputClass} value={form.brand} onChange={set("brand")} required />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-gray-700">SKU</span>
            <input className={inputClass} value={form.sku} onChange={set("sku")} />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-gray-700">Category</span>
            <select className={inputClass} value={form.category} onChange={set("category")} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-gray-700">Base price (Rs.)</span>
            <input type="number" min="0.01" step="0.01" className={inputClass} value={form.base_price} onChange={set("base_price")} required />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-gray-700">Stock</span>
            <input type="number" min="0" className={inputClass} value={form.stock_quantity} onChange={set("stock_quantity")} required />
          </label>
          <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-xs">
            <input type="checkbox" checked={form.is_active} onChange={set("is_active")} />
            <span className="font-medium text-gray-700">Active (visible on storefront)</span>
          </label>
          <label className="col-span-2 text-xs md:col-span-4">
            <span className="mb-1 block font-medium text-gray-700">Description</span>
            <textarea className={`${inputClass} min-h-[60px]`} value={form.description} onChange={set("description")} required />
          </label>
          <div className="col-span-2 flex items-center gap-3 md:col-span-4">
            <button type="submit" disabled={saving} className="rounded-md bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:underline">Cancel</button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </form>
      </td>
    </tr>
  );
}

function CategoryResolutionModal({ product, categories, onResolved, onCancel }) {
  const [mode, setMode] = useState("existing"); // "existing" | "new"
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState(product.requested_category_name || "");
  const [commissionRate, setCommissionRate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (mode === "existing" && !categoryId) {
      setError("Pick a category to assign this product to.");
      return;
    }
    if (mode === "new" && (!newCategoryName.trim() || !commissionRate)) {
      setError("Enter a name and a commission rate for the new category.");
      return;
    }
    setSaving(true);
    try {
      const body = mode === "existing"
        ? { category_id: categoryId }
        : { new_category_name: newCategoryName.trim(), commission_rate_percent: commissionRate };
      await api.post(`/products/admin/products/${product.id}/approve/`, body);
      onResolved();
    } catch (err) {
      setError(err.data?.detail || "Couldn't approve this product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-gray-100 bg-amber-50/60">
      <td colSpan={8} className="p-3">
        <div className="rounded-md border border-amber-200 bg-white p-3">
          <p className="text-xs font-semibold text-amber-800">
            &quot;{product.name}&quot; doesn&apos;t match any existing category — the vendor requested &quot;{product.requested_category_name}&quot;.
          </p>
          <p className="mt-0.5 text-xs text-gray-500">Resolve this before approving: assign it to an existing category, or add &quot;{product.requested_category_name}&quot; as a new one.</p>

          <div className="mt-3 flex gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} />
              Assign to existing category
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
              Create new category
            </label>
          </div>

          {mode === "existing" ? (
            <select className={`${inputClass} mt-2 w-64`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="" disabled>Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className={`${inputClass} w-56`} placeholder="New category name"
                value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <input
                className={`${inputClass} w-40`} type="number" min="0" step="0.01" placeholder="Commission rate %"
                value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)}
              />
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button disabled={saving} onClick={submit} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
              {saving ? "Approving..." : "Resolve & Approve"}
            </button>
            <button onClick={onCancel} className="text-xs text-gray-500 hover:underline">Cancel</button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </div>
      </td>
    </tr>
  );
}

function ProductRow({ product, categories, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [resolvingCategory, setResolvingCategory] = useState(false);
  const [busy, setBusy] = useState(false);

  const decide = async (action) => {
    if (action === "approve" && product.has_category_mismatch) {
      setResolvingCategory(true);
      return;
    }
    setBusy(true);
    try {
      await api.post(`/products/admin/products/${product.id}/${action}/`, {});
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${product.name}"? This also removes its images and any pending discount/restock requests. This can't be undone.`)) return;
    setBusy(true);
    try {
      await api.delete(`/products/admin/products/${product.id}/`);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <EditProductForm
        product={product}
        categories={categories}
        onSaved={() => { setEditing(false); onChanged(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (resolvingCategory) {
    return (
      <CategoryResolutionModal
        product={product}
        categories={categories}
        onResolved={() => { setResolvingCategory(false); onChanged(); }}
        onCancel={() => setResolvingCategory(false)}
      />
    );
  }

  return (
    <tr className="border-t border-gray-100 text-sm">
      <td className="p-2">
        <p className="font-medium text-gray-900">{product.name}</p>
        <p className="text-xs text-gray-500">{product.brand}{product.sku ? ` · SKU ${product.sku}` : ""}</p>
      </td>
      <td className="p-2 text-xs text-gray-600">{product.vendor_name}</td>
      <td className="p-2 text-xs">
        {product.has_category_mismatch ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">Wants: {product.requested_category_name}</span>
        ) : (
          <span className="text-gray-600">{product.category_name}</span>
        )}
      </td>
      <td className="p-2">{formatPKR(product.base_price)}</td>
      <td className="p-2">{product.stock_quantity}</td>
      <td className="p-2"><StatusBadge status={product.status} /></td>
      <td className="p-2 text-xs">
        {product.is_active ? <span className="text-green-700">Active</span> : <span className="text-gray-400">Paused</span>}
      </td>
      <td className="p-2">
        <div className="flex flex-wrap items-center gap-2">
          {product.status === "pending" && (
            <>
              <button disabled={busy} onClick={() => decide("approve")} className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700">
                <Check className="h-3.5 w-3.5" /> Approve
              </button>
              <button disabled={busy} onClick={() => decide("reject")} className="flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-200">
                <X className="h-3.5 w-3.5" /> Reject
              </button>
            </>
          )}
          <button disabled={busy} onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button disabled={busy} onClick={remove} className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminProducts() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", page);
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (search) params.set("search", search);
    const data = await api.get(`/products/admin/products/?${params.toString()}`);
    setProducts(data.results ?? data);
    setCount(data.count ?? (data.results ?? data).length);
    setLoading(false);
  };

  useEffect(() => {
    api.get("/products/categories/").then((data) => setCategories(data.results ?? data));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, categoryFilter, search]);

  const submitSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Products</h1>
        <button onClick={load} className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setPage(1); setStatusFilter(tab.value); }}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${
                statusFilter === tab.value ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          className={`${inputClass} w-48`}
          value={categoryFilter}
          onChange={(e) => { setPage(1); setCategoryFilter(e.target.value); }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <form onSubmit={submitSearch} className="flex items-center gap-1">
          <input
            className={`${inputClass} w-56`}
            placeholder="Search product, brand, SKU, or vendor..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50">
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-2">Product</th>
              <th className="p-2">Vendor</th>
              <th className="p-2">Category</th>
              <th className="p-2">Price</th>
              <th className="p-2">Stock</th>
              <th className="p-2">Status</th>
              <th className="p-2">Visibility</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-4 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={8} className="p-4 text-center text-sm text-gray-500">No products match these filters.</td></tr>
            ) : (
              products.map((product) => (
                <ProductRow key={product.id} product={product} categories={categories} onChanged={load} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40">
            Previous
          </button>
          <span className="text-gray-500">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
