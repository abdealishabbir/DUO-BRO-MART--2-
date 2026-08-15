import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Package } from "lucide-react";
import { api } from "../../lib/api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { formatPKR } from "../../lib/currency.js";
import { SkeletonTable } from "../../components/Skeleton.jsx";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// Mirrors the exact vendor_name computation from
// backend/apps/orders/serializers.OrderItemSerializer.get_vendor_name(),
// so the vendor_name string on each item lines up 1:1 with our own name.
// vendor_id is now also sent per item (see backend change), so we prefer
// matching on id and only fall back to the name match for safety.
function myItemsFromOrder(order, vendorId, myName) {
  return order.items.filter((item) => (item.vendor_id != null ? item.vendor_id === vendorId : item.vendor_name === myName));
}

export default function VendorOrders() {
  const { user } = useAuth();
  const myName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || user?.username || "";

  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    setError("");
    try {
      // VendorOrdersView uses the project-wide default DRF pagination
      // (PageNumberPagination, 20/page) with no page_size override
      // supported server-side, so a vendor with >20 orders would silently
      // lose everything past page 1 if we only fetched once. Walk every
      // page via the `next` link instead.
      let all = [];
      let url = "/orders/vendor/";
      while (url) {
        const res = await api.get(url);
        if (Array.isArray(res)) {
          all = res;
          break;
        }
        all = all.concat(res.results ?? []);
        url = res.next ? res.next.replace(/^https?:\/\/[^/]+\/api/, "") : null;
      }
      setOrders(all);
    } catch {
      setError("Couldn't load your orders. Please refresh.");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    if (!orders) return [];
    return orders
      .map((order) => {
        const myItems = myItemsFromOrder(order, user?.id, myName);
        const myTotal = myItems.reduce((sum, i) => sum + Number(i.net_to_vendor), 0);
        return { order, myItems, myTotal };
      })
      .filter(({ myItems }) => myItems.length > 0);
  }, [orders, user?.id, myName]);

  const filtered = rows.filter(({ order, myItems }) => {
    if (statusFilter && order.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchesCode = order.order_code.toLowerCase().includes(q);
      const matchesProduct = myItems.some((i) => i.product_name.toLowerCase().includes(q));
      if (!matchesCode && !matchesProduct) return false;
    }
    return true;
  });

  const totalDue = rows
    .filter(({ order }) => order.status === "delivered")
    .reduce((sum, { myTotal }) => sum + myTotal, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Orders</h2>
          <p className="text-sm text-gray-500">
            {orders === null ? <span className="inline-block h-3.5 w-48 animate-pulse rounded bg-gray-200 align-middle" /> : `${rows.length} order${rows.length !== 1 ? "s" : ""} contain your products`}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-brand hover:text-brand">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Orders (filtered view)</p>
          <p className="mt-1 text-lg font-bold text-ink">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Delivered — Your Earnings</p>
          <p className="mt-1 text-lg font-bold text-green-700">{formatPKR(totalDue)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Pending / Processing</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {rows.filter(({ order }) => order.status === "pending" || order.status === "processing").length}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
            placeholder="Search by order code or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
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
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        {orders === null ? (
          <SkeletonTable columns={6} rows={6} />
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Package className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              {rows.length === 0 ? "No orders yet — they'll show up here as soon as a customer buys one of your products." : "No orders match your search/filter."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Your Items</th>
                <th className="px-4 py-3">Your Earnings</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Placed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ order, myItems, myTotal }) => (
                <tr key={order.id} className="border-b border-gray-50 last:border-0 align-top">
                  <td className="px-4 py-3 font-medium text-ink">{order.order_code}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {order.shipping_full_name}
                    <br />
                    <span className="text-gray-400">{order.shipping_city}, {order.shipping_province}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {myItems.map((i) => (
                      <div key={i.id}>{i.quantity} × {i.product_name}</div>
                    ))}
                  </td>
                  <td className="px-4 py-3 font-medium text-green-700">{formatPKR(myTotal)}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
