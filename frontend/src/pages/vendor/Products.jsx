import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search, Filter, Plus, Pencil, Trash2, Upload, X, Info, ArrowLeft,
} from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import FormField, { inputClass } from "../../components/FormField.jsx";

const EMPTY_FORM = { name: "", sku: "", category: "", base_price: "", stock_quantity: "", description: "" };

const STATUS_BADGE = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[status]}`}>{status}</span>
  );
}

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-gray-300"} ${disabled ? "opacity-40" : ""}`}
      aria-pressed={checked}
    >
      <span className={`block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function ProductForm({ categories, editingProduct, onDone, onCancel }) {
  const [form, setForm] = useState(
    editingProduct
      ? {
          name: editingProduct.name, sku: editingProduct.sku, category: editingProduct.category,
          base_price: editingProduct.base_price, stock_quantity: editingProduct.stock_quantity,
          description: editingProduct.description,
        }
      : EMPTY_FORM
  );
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const estimatedListPrice = form.base_price ? formatPKR(Number(form.base_price) * 1.1) : null;

  const addFiles = (fileList) => {
    const next = Array.from(fileList).slice(0, 5 - files.length);
    setFiles((f) => [...f, ...next]);
  };

  const submit = async (asDraft) => {
    setError("");
    if (!form.name || !form.category || !form.base_price || form.stock_quantity === "" || !form.description) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, base_price: Number(form.base_price), stock_quantity: Number(form.stock_quantity) };
      let product;
      if (editingProduct) {
        product = await api.patch(`/products/vendor/products/${editingProduct.id}/`, payload);
      } else {
        product = await api.post("/products/vendor/products/", payload);
      }

      for (const file of files) {
        const formData = new FormData();
        formData.append("image", file);
        await api.postForm(`/products/vendor/products/${product.id}/upload-image/`, formData);
      }

      if (!asDraft) {
        await api.post(`/products/vendor/products/${product.id}/submit/`);
      }

      onDone();
    } catch (err) {
      setError(err.data?.detail || Object.values(err.data ?? {})[0]?.[0] || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-ink">{editingProduct ? "Edit Product" : "New Product Listing"}</h3>

      {!editingProduct && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Enter <strong>your</strong> price — Duo Bro Mart's commission is added on top for the customer, you always keep what you set.</span>
        </div>
      )}

      <div className="mt-5 space-y-4">
        <FormField label="Product Name *">
          <input className={inputClass} placeholder="e.g. Wireless Bluetooth Speaker" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Your Price (PKR) *">
            <input type="number" min="0" className={inputClass} placeholder="0" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} />
            {estimatedListPrice && <p className="mt-1 text-xs text-gray-400">Customer sees ~{estimatedListPrice} (incl. commission)</p>}
          </FormField>
          <FormField label="Category *">
            <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="" disabled>Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Stock Quantity *">
            <input type="number" min="0" className={inputClass} placeholder="0" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
          </FormField>
          <FormField label="SKU">
            <input className={inputClass} placeholder="e.g. DBM-SP-001" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </FormField>
        </div>

        <FormField label="Description *">
          <textarea className={`${inputClass} min-h-[90px] resize-y`} placeholder="Describe your product..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </FormField>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Product Images</span>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            onDragOver={(e) => e.preventDefault()}
            className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-center hover:border-brand"
          >
            <Upload className="mx-auto h-5 w-5 text-gray-400" />
            <p className="mt-2 text-sm font-medium text-gray-600">Drop images here or click to upload</p>
            <p className="text-xs text-gray-400">JPG, PNG · Max 5 images · Up to 5MB each</p>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </div>
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={i} className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                  {f.name}
                  <button type="button" onClick={() => setFiles((fs) => fs.filter((_, idx) => idx !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button" disabled={saving} onClick={() => submit(false)}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save & Submit for Review"}
          </button>
          <button
            type="button" disabled={saving} onClick={() => submit(true)}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Save as Draft
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VendorProducts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [view, setView] = useState(searchParams.get("new") ? "create" : "list");
  const [editingProduct, setEditingProduct] = useState(null);
  const [error, setError] = useState("");

  const loadProducts = () => {
    api.get("/products/vendor/products/?page_size=200")
      .then((res) => setProducts(res.results ?? []))
      .catch(() => setError("Couldn't load your products. Please refresh."));
  };

  useEffect(() => {
    loadProducts();
    api.get("/products/categories/?page_size=100").then((res) => setCategories(res.results ?? [])).catch(() => {});
  }, []);

  const closeForm = () => {
    setView("list");
    setEditingProduct(null);
    searchParams.delete("new");
    setSearchParams(searchParams, { replace: true });
    loadProducts();
  };

  const toggleActive = async (product) => {
    try {
      const updated = await api.post(`/products/vendor/products/${product.id}/toggle-active/`);
      setProducts((ps) => ps.map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      setError("Couldn't update that product right now.");
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This can't be undone.`)) return;
    try {
      await api.delete(`/products/vendor/products/${product.id}/`);
      setProducts((ps) => ps.filter((p) => p.id !== product.id));
    } catch (err) {
      setError(err.data?.detail || "Only draft products (not yet submitted) can be deleted.");
    }
  };

  const submitForReview = async (product) => {
    try {
      const updated = await api.post(`/products/vendor/products/${product.id}/submit/`);
      setProducts((ps) => ps.map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      setError("Couldn't submit that product for review right now.");
    }
  };

  const filtered = (products ?? []).filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });
  const outOfStockCount = (products ?? []).filter((p) => p.stock_quantity === 0).length;

  if (view === "create" || view === "edit") {
    return (
      <div>
        <button onClick={closeForm} className="mb-4 flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to My Products
        </button>
        <ProductForm categories={categories} editingProduct={editingProduct} onDone={closeForm} onCancel={closeForm} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">My Products</h2>
          <p className="text-sm text-gray-500">
            {products === null ? "Loading..." : `${products.length} listing${products.length !== 1 ? "s" : ""} · ${outOfStockCount} out of stock`}
          </p>
        </div>
        <button
          onClick={() => setView("create")}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
        >
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
            placeholder="Search products..."
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowFilter((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-brand"
        >
          <Filter className="h-4 w-4" /> Filter
        </button>
      </div>

      {showFilter && (
        <div className="mt-2 flex flex-wrap gap-2">
          {["", "draft", "pending", "approved", "rejected"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                statusFilter === s ? "bg-brand text-white" : "border border-gray-300 text-gray-600"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span><strong>List Price</strong> = what customers see. <strong>Your Earnings</strong> = your own price, unaffected by commission.</span>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        {products === null ? (
          <p className="p-6 text-sm text-gray-400">Loading your products...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            {products.length === 0 ? "No products yet — click \"Add Product\" to create your first listing." : "No products match your search/filter."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">List Price</th>
                <th className="px-4 py-3">Your Earnings</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const fee = Number(p.selling_price) - Number(p.base_price);
                const feePct = p.base_price > 0 ? Math.round((fee / p.base_price) * 100) : 0;
                return (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 overflow-hidden">
                          {p.images?.[0] ? <img src={p.images[0].image} alt="" className="h-full w-full object-cover" /> : null}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{p.name}</p>
                          {p.status === "rejected" && p.admin_notes && (
                            <p className="truncate text-xs text-red-500">{p.admin_notes}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{p.sku || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 font-medium text-ink">{formatPKR(p.selling_price)}</td>
                    <td className="px-4 py-3 font-medium text-green-700">{formatPKR(p.base_price)}</td>
                    <td className="px-4 py-3 text-xs text-red-500">-{formatPKR(fee)} ({feePct}%)</td>
                    <td className={`px-4 py-3 ${p.stock_quantity === 0 ? "font-medium text-red-600" : p.stock_quantity <= 10 ? "font-medium text-amber-600" : "text-gray-700"}`}>
                      {p.stock_quantity === 0 ? "Out of stock" : p.stock_quantity}
                    </td>
                    <td className="px-4 py-3">
                      <ToggleSwitch checked={p.is_active} disabled={p.status !== "approved"} onChange={() => toggleActive(p)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(p.status === "draft" || p.status === "rejected") && (
                          <button onClick={() => submitForReview(p)} className="text-xs font-medium text-brand hover:underline">
                            Submit
                          </button>
                        )}
                        {(p.status === "draft" || p.status === "rejected") && (
                          <button onClick={() => { setEditingProduct(p); setView("edit"); }} className="text-gray-400 hover:text-brand">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {p.status === "draft" && (
                          <button onClick={() => deleteProduct(p)} className="text-gray-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
