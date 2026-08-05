import { useEffect, useState } from "react";
import { RefreshCw, Eye, ShoppingBag, TrendingUp, Percent } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";

const RANGES = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
];

const SOURCE_LABELS = { direct: "Direct", search: "Search", social: "Social", other: "Other" };
const SOURCE_COLORS = { direct: "bg-brand", search: "bg-blue-500", social: "bg-purple-500", other: "bg-gray-400" };

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-gray-400"><Icon className="h-3.5 w-3.5" /><p className="text-xs font-medium uppercase tracking-wide">{label}</p></div>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function VendorAnalytics() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    api.get(`/products/vendor/analytics/?range=${range}`)
      .then(setData)
      .catch(() => setError("Couldn't load analytics. Please refresh."));
  };

  useEffect(load, [range]);

  const totalViews = data?.total_views ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Analytics</h2>
          <p className="text-sm text-gray-500">Revenue, views and conversion for your storefront presence.</p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${range === r.value ? "bg-brand text-white" : "border border-gray-300 text-gray-600 hover:border-brand"}`}
            >
              {r.label}
            </button>
          ))}
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-brand hover:text-brand">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!data ? (
        <p className="mt-6 text-sm text-gray-400">Loading...</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={TrendingUp} label="Revenue" value={formatPKR(data.revenue)} hint={`${data.order_count} order${data.order_count !== 1 ? "s" : ""}`} />
            <StatCard icon={ShoppingBag} label="Units Sold" value={data.units_sold} />
            <StatCard icon={Eye} label="Product Views" value={totalViews} />
            <StatCard
              icon={Percent}
              label="Conversion Rate"
              value={data.conversion_rate != null ? `${data.conversion_rate}%` : "—"}
              hint={data.conversion_rate == null ? "No views yet in this range" : "orders ÷ views"}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-ink">Top Products</h3>
              {data.top_products.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">No sales in this range yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {data.top_products.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <span className="truncate text-gray-700">{p.name}</span>
                      <span className="ml-2 shrink-0 font-medium text-ink">{formatPKR(p.revenue)} <span className="text-xs text-gray-400">({p.units} units)</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-ink">Traffic Sources</h3>
              {totalViews === 0 ? (
                <p className="mt-3 text-sm text-gray-400">No product views recorded in this range yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {Object.entries(data.traffic_sources).map(([source, count]) => {
                    const pct = totalViews ? Math.round((count / totalViews) * 100) : 0;
                    return (
                      <div key={source}>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>{SOURCE_LABELS[source] || source}</span>
                          <span>{count} ({pct}%)</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                          <div className={`h-1.5 rounded-full ${SOURCE_COLORS[source] || "bg-gray-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            Views are logged from real product-detail page visits; traffic source is a best-effort guess from the visitor&apos;s referrer, not full UTM tracking.
          </p>
        </>
      )}
    </div>
  );
}
