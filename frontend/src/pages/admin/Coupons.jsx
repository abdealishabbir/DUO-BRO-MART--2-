import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { inputClass } from "../../components/FormField.jsx";
import { SkeletonTable } from "../../components/Skeleton.jsx";
import { cardClasses } from "../../components/Card.jsx";
import Badge from "../../components/Badge.jsx";

const EMPTY_FORM = {
  code: "", discount_type: "percent", discount_value: "", min_order_value: "0",
  max_uses: "", valid_from: "", valid_until: "", is_active: true,
};

function toDatetimeLocal(iso) {
  if (!iso) return "";
  return iso.slice(0, 16); // "2026-08-02T14:30:00Z" -> "2026-08-02T14:30"
}

function CouponForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(
    initial
      ? {
          code: initial.code, discount_type: initial.discount_type, discount_value: initial.discount_value,
          min_order_value: initial.min_order_value, max_uses: initial.max_uses ?? "",
          valid_from: toDatetimeLocal(initial.valid_from), valid_until: toDatetimeLocal(initial.valid_until),
          is_active: initial.is_active,
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.code.trim() || !form.discount_value) {
      setError("Code and discount value are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        max_uses: form.max_uses === "" ? null : Number(form.max_uses),
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
      };
      if (initial) {
        await api.patch(`/orders/admin/coupons/${initial.id}/`, payload);
      } else {
        await api.post("/orders/admin/coupons/", payload);
      }
      onSaved();
    } catch (err) {
      setError(err.data?.code?.[0] || err.data?.detail || "Couldn't save this coupon.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className={cardClasses()}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-gray-700">Code *</span>
          <input className={`${inputClass} uppercase`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-gray-700">Type</span>
          <select className={inputClass} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
            <option value="percent">Percent Off</option>
            <option value="fixed">Fixed Amount Off (PKR)</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-gray-700">
            Discount Value * {form.discount_type === "percent" ? "(%)" : "(Rs.)"}
          </span>
          <input type="number" min="0" step="0.01" className={inputClass} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-gray-700">Minimum Order Value (Rs.)</span>
          <input type="number" min="0" step="0.01" className={inputClass} value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: e.target.value })} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-gray-700">Max Uses</span>
          <input type="number" min="1" placeholder="Unlimited" className={inputClass} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
        </label>
        <div />
        <label className="text-xs">
          <span className="mb-1 block font-medium text-gray-700">Valid From</span>
          <input type="datetime-local" className={inputClass} value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-gray-700">Valid Until</span>
          <input type="datetime-local" className={inputClass} value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs font-medium text-gray-700">
        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
        Active
      </label>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={saving} className="rounded-md bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
          {saving ? "Saving..." : initial ? "Save Changes" : "Create Coupon"}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:underline">Cancel</button>
      </div>
    </form>
  );
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    api.get("/orders/admin/coupons/").then((res) => setCoupons(res.results ?? res)).catch(() => setError("Couldn't load coupons."));
  };

  useEffect(load, []);

  const remove = async (coupon) => {
    if (!window.confirm(`Delete coupon "${coupon.code}"? This can't be undone.`)) return;
    await api.delete(`/orders/admin/coupons/${coupon.id}/`);
    load();
  };

  const isExpired = (c) => c.valid_until && new Date(c.valid_until) < new Date();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-heading">Coupons</h2>
          <p className="text-sm text-gray-500">Discount codes customers can apply at checkout.</p>
        </div>
        {!showForm && !editing && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <Plus className="h-4 w-4" /> New Coupon
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4">
          <CouponForm onSaved={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />
        </div>
      )}
      {editing && (
        <div className="mt-4">
          <CouponForm initial={editing} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-surface shadow-sm">
        {coupons === null ? (
          <SkeletonTable columns={7} rows={5} />
        ) : coupons.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-500">No coupons yet — create one to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Min Order</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Valid Until</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-mono font-semibold text-heading">{c.code}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {c.discount_type === "percent" ? `${c.discount_value}% off` : `${formatPKR(c.discount_value)} off`}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{Number(c.min_order_value) > 0 ? formatPKR(c.min_order_value) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.valid_until ? new Date(c.valid_until).toLocaleDateString() : "No expiry"}</td>
                  <td className="px-4 py-3">
                    {!c.is_active ? (
                      <Badge variant="neutral">Inactive</Badge>
                    ) : isExpired(c) ? (
                      <Badge variant="danger">Expired</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditing(c); setShowForm(false); }} className="text-gray-400 hover:text-brand" aria-label={`Edit ${c.code}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(c)} className="text-gray-400 hover:text-red-600" aria-label={`Delete ${c.code}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
