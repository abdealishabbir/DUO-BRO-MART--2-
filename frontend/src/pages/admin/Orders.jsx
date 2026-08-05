import { useEffect, Fragment, useState } from "react";
import { RefreshCw, Search, Info, Download } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { inputClass } from "../../components/FormField.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function productSummary(order) {
  if (order.items.length === 0) return "—";
  const first = order.items[0].product_name;
  return order.items.length > 1 ? `${first} +${order.items.length - 1} more` : first;
}

function OrderDetailRow({ order, onChanged }) {
  const [status, setStatus] = useState(order.status);
  const [courier, setCourier] = useState(order.courier_name || "");
  const [notes, setNotes] = useState(order.admin_notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.patch(`/orders/admin/${order.id}/`, { status, courier_name: courier, admin_notes: notes });
      onChanged();
    } catch (err) {
      setError(err.data?.detail || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-gray-100 bg-blue-50/40">
      <td colSpan={9} className="p-4">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Items</h4>
            <div className="mt-2 space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-2 text-xs">
                  <div>
                    <p className="font-medium text-gray-900">{item.product_name}</p>
                    <p className="text-gray-500">Qty {item.quantity} · Vendor: {item.vendor_name ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatPKR(item.line_total)}</p>
                    <p className="text-red-600">-{formatPKR(item.commission_amount)}</p>
                    <p className="text-green-700">{formatPKR(item.net_to_vendor)} net</p>
                  </div>
                </div>
              ))}
            </div>

            <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Shipping To</h4>
            <p className="mt-1 text-xs text-gray-700">
              {order.shipping_full_name} · {order.shipping_phone_number} · {order.shipping_email}
              <br />
              {order.shipping_address_line}, {order.shipping_city}, {order.shipping_province}
              {order.shipping_is_rural && order.shipping_landmark && (
                <> · Landmark: {order.shipping_landmark} (rural — collect from branch)</>
              )}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Update Order</h4>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="text-xs">
                <span className="mb-1 block font-medium text-gray-700">Status</span>
                <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {["pending", "processing", "shipped", "delivered", "cancelled"].map((s) => (
                    <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-gray-700">Courier</span>
                <input className={inputClass} placeholder="e.g. TCS, Leopards" value={courier} onChange={(e) => setCourier(e.target.value)} />
              </label>
              <label className="col-span-2 text-xs">
                <span className="mb-1 block font-medium text-gray-700">Admin Notes</span>
                <textarea className={`${inputClass} min-h-[60px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={save} disabled={saving} className="rounded-md bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">
                {saving ? "Saving..." : "Save changes"}
              </button>
              {error && <span className="text-xs text-red-600">{error}</span>}
            </div>

            <div className="mt-4 flex justify-between border-t border-gray-200 pt-3 text-sm font-bold text-gray-900">
              <span>Order Total</span>
              <span>{formatPKR(order.total)}</span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    const data = await api.get(`/orders/admin/?${params.toString()}`);
    const results = data.results ?? data;
    setOrders(results);
    setCount(data.count ?? results.length);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search]);

  const submitSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const reload = () => {
    setExpandedId(null);
    load();
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Orders</h1>
        <div className="flex items-center gap-2">
          <a
            href={`${API_BASE}/orders/admin/export/orders/${statusFilter ? `?status=${statusFilter}` : ""}`}
            download
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-brand hover:text-brand"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
          <button onClick={load} className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${
                statusFilter === tab.value ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={submitSearch} className="flex items-center gap-1">
          <input
            className={`${inputClass} w-56`}
            placeholder="Search by Order ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50">
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Each row shows Sale Price (what the customer paid) → Commission (platform&apos;s cut) → Net to Vendor (transferred to vendor).</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-2">Order ID</th>
              <th className="p-2">Date</th>
              <th className="p-2">Customer</th>
              <th className="p-2">Product</th>
              <th className="p-2">Sale Price</th>
              <th className="p-2">Commission</th>
              <th className="p-2">Net to Vendor</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="p-4 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={9} className="p-4 text-center text-sm text-gray-500">No orders match these filters.</td></tr>
            ) : (
              orders.map((order) => {
                const isCancelled = order.status === "cancelled";
                return (
                  <Fragment key={order.id}>
                    <tr className="border-t border-gray-100 text-sm">
                      <td className="p-2 font-mono text-xs font-semibold text-gray-900">#{order.order_code}</td>
                      <td className="p-2 text-xs text-gray-600">
                        {new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="p-2 text-xs text-gray-600">{order.shipping_full_name}</td>
                      <td className="p-2 text-xs text-gray-600">{productSummary(order)}</td>
                      <td className="p-2">{formatPKR(order.subtotal)}</td>
                      <td className="p-2">
                        {isCancelled ? <span className="text-gray-400">—</span> : <span className="text-red-600">-{formatPKR(order.commission_total)}</span>}
                      </td>
                      <td className="p-2">
                        {isCancelled ? <span className="text-gray-400">—</span> : <span className="font-semibold text-green-700">{formatPKR(order.net_to_vendor_total)}</span>}
                      </td>
                      <td className="p-2"><StatusBadge status={order.status} /></td>
                      <td className="p-2">
                        <button
                          onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          {expandedId === order.id ? "Close" : "View"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === order.id && <OrderDetailRow order={order} onChanged={reload} />}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">Showing {orders.length} of {count} orders.</p>
    </div>
  );
}
