import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Clock, CheckCircle2, ShoppingBag, Info, AlertTriangle, PlusCircle } from "lucide-react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { Skeleton } from "../../components/Skeleton.jsx";

const LOW_STOCK_THRESHOLD = 10;

function StatCard({ icon: Icon, value, label, sub }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

const STATUS_BADGE = {
  draft: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function VendorDashboard() {
  const { user } = useAuth();
  const [products, setProducts] = useState(null);
  const [bannerApps, setBannerApps] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/products/vendor/products/?page_size=100").catch(() => null),
      api.get("/banners/vendor/applications/").catch(() => null),
    ]).then(([productsRes, bannersRes]) => {
      setProducts(productsRes?.results ?? []);
      setBannerApps(bannersRes?.results ?? bannersRes ?? []);
    }).catch(() => setError("Couldn't load your dashboard data. Please refresh."));
  }, []);

  const loading = products === null;
  const counts = {
    total: products?.length ?? 0,
    pending: products?.filter((p) => p.status === "pending").length ?? 0,
    approved: products?.filter((p) => p.status === "approved").length ?? 0,
    rejected: products?.filter((p) => p.status === "rejected").length ?? 0,
  };
  const lowStock = (products ?? []).filter((p) => p.status === "approved" && p.stock_quantity <= LOW_STOCK_THRESHOLD);
  const pendingBanner = (bannerApps ?? []).find((b) => b.status === "pending");
  const recentProducts = (products ?? []).slice(0, 5);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Welcome back, {user?.name?.split(" ")[0] ?? "there"} 👋</h2>
          <p className="text-sm text-gray-500">Here&apos;s how your store is doing today.</p>
        </div>
        <Link
          to="/vendor/products?new=1"
          className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
        >
          <PlusCircle className="h-4 w-4" /> Add Product
        </Link>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Platform fee (10%, provisional):</strong> your product&apos;s list price already includes Duo Bro Mart&apos;s commission on top of what you set —
          you always receive your own base price in full. The exact admin-configurable rate lands with platform Settings.
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Package} value={loading ? "…" : counts.total} label="Total Products" />
        <StatCard icon={Clock} value={loading ? "…" : counts.pending} label="Pending Review" />
        <StatCard icon={CheckCircle2} value={loading ? "…" : counts.approved} label="Live on Store" />
        <StatCard icon={ShoppingBag} value="—" label="Orders Received" sub="Arrives with order tracking" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-ink">Recent Products</h3>
            <Link to="/vendor/products" className="text-xs font-medium text-brand hover:underline">View all</Link>
          </div>
          {loading ? (
            <ul className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
                </li>
              ))}
            </ul>
          ) : recentProducts.length === 0 ? (
            <p className="text-sm text-gray-500">
              No products yet. <Link to="/vendor/products?new=1" className="font-medium text-brand hover:underline">Add your first one</Link>.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                    <p className="text-xs text-gray-400">{formatPKR(p.selling_price)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[p.status]}`}>
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-bold text-ink">Pending Actions</h3>
          <div className="space-y-2">
            {counts.rejected > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{counts.rejected} product{counts.rejected !== 1 && "s"} rejected — review admin notes and resubmit.</span>
              </div>
            )}
            {lowStock.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{lowStock.length} product{lowStock.length !== 1 && "s"} low on stock (≤{LOW_STOCK_THRESHOLD} units).</span>
              </div>
            )}
            {pendingBanner && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Your banner application is under review.</span>
              </div>
            )}
            {!loading && counts.rejected === 0 && lowStock.length === 0 && !pendingBanner && (
              <p className="text-sm text-gray-500">All caught up — nothing needs your attention right now.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
