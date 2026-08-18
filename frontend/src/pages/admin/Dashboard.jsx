import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import ImageWithFallback from "../../components/ImageWithFallback.jsx";
import { Skeleton, SkeletonStatCard, SkeletonTable } from "../../components/Skeleton.jsx";
import Card from "../../components/Card.jsx";

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-6 w-48" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padding="md" className="lg:col-span-2">
          <Skeleton className="mb-3 h-4 w-28" />
          <SkeletonTable columns={6} rows={5} cellClassName="p-1.5" />
        </Card>
        <Card padding="md">
          <Skeleton className="mb-3 h-4 w-36" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

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

function ChangeIndicator({ pct }) {
  if (pct === null || pct === undefined) {
    return <p className="mt-1 text-xs text-gray-400">No data for last month yet</p>;
  }
  const positive = pct >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
      <Icon className="h-3 w-3" /> {positive ? "+" : ""}{pct}% vs last month
    </p>
  );
}

function KpiCard({ label, value, sublabel, children }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-gray-400">{sublabel}</p>}
      {children}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/orders/admin/dashboard/").then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading || !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-bold text-gray-900">Dashboard Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Platform Revenue" value={formatPKR(data.platform_revenue.total)} sublabel="Total gross from customers">
          <ChangeIndicator pct={data.platform_revenue.change_pct} />
        </KpiCard>
        <KpiCard label="Duo Bro Mart Earnings" value={formatPKR(data.platform_commission.total)} sublabel="Platform commission">
          <ChangeIndicator pct={data.platform_commission.change_pct} />
        </KpiCard>
        <KpiCard label="Active Products" value={data.active_products} sublabel={`Across ${data.category_count} categories`} />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700">Pending Vendors</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{data.pending_vendors}</p>
          {data.pending_vendors > 0 && (
            <Link to="/admin/vendors" className="mt-1 inline-block rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Needs Review
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padding="md" className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Recent Orders</h2>
            <Link to="/admin/orders" className="text-xs font-medium text-brand hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-500">
                <tr>
                  <th className="p-1.5">Order ID</th>
                  <th className="p-1.5">Customer</th>
                  <th className="p-1.5">Product</th>
                  <th className="p-1.5">Sale Price</th>
                  <th className="p-1.5">Commission</th>
                  <th className="p-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.length === 0 ? (
                  <tr><td colSpan={6} className="p-3 text-center text-gray-400">No orders yet.</td></tr>
                ) : (
                  data.recent_orders.map((order) => (
                    <tr key={order.id} className="border-t border-gray-100">
                      <td className="p-1.5 font-mono text-xs font-semibold text-gray-900">#{order.order_code}</td>
                      <td className="p-1.5 text-gray-600">{order.customer}</td>
                      <td className="p-1.5 text-gray-600">{order.product}</td>
                      <td className="p-1.5">{formatPKR(order.sale_price)}</td>
                      <td className="p-1.5">{order.commission === null ? <span className="text-gray-400">—</span> : <span className="text-red-600">-{formatPKR(order.commission)}</span>}</td>
                      <td className="p-1.5"><StatusBadge status={order.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card padding="md">
          <h2 className="mb-3 text-sm font-bold text-gray-900">Top Products This Week</h2>
          <div className="space-y-3">
            {data.top_products.length === 0 ? (
              <p className="text-xs text-gray-400">No sales in the last 7 days yet.</p>
            ) : (
              data.top_products.map((product) => (
                <div key={product.slug} className="flex items-center gap-3">
                  <ImageWithFallback
                    src={product.image}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                    iconClassName="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-400">{product.units_sold} units sold</p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold text-brand">{formatPKR(product.revenue)}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
