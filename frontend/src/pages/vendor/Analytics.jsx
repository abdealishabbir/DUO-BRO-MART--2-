import { useEffect, useState } from "react";
import { RefreshCw, Eye, ShoppingBag, TrendingUp, Percent, Download, Calendar } from "lucide-react";
import { api } from "../../lib/api.js";
import { formatPKR } from "../../lib/currency.js";
import { SkeletonStatCard, SkeletonText } from "../../components/Skeleton.jsx";

function AnalyticsSkeleton() {
  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-surface p-4 shadow-sm">
            <div className="h-3.5 w-24 animate-pulse rounded bg-gray-200" />
            <SkeletonText lines={4} className="mt-4" />
          </div>
        ))}
      </div>
    </>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const RANGES = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "custom", label: "Custom" },
];

// Default "from" = 30 days ago, "to" = today
function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

const SOURCE_LABELS = { direct: "Direct", search: "Search", social: "Social", other: "Other" };
const SOURCE_COLORS = { direct: "bg-brand", search: "bg-blue-500", social: "bg-purple-500", other: "bg-gray-400" };

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-gray-400"><Icon className="h-3.5 w-3.5" /><p className="text-xs font-medium uppercase tracking-wide">{label}</p></div>
      <p className="mt-1 text-lg font-bold text-heading">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function VendorAnalytics() {
  const [range, setRange] = useState("30d");
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const buildUrl = () => {
    if (range === "custom") {
      return `/products/vendor/analytics/?from=${fromDate}&to=${toDate}`;
    }
    return `/products/vendor/analytics/?range=${range}`;
  };

  const buildExportUrl = () => {
    if (range === "custom") {
      return `${API_BASE}/products/vendor/analytics/export/?from=${fromDate}&to=${toDate}`;
    }
    return `${API_BASE}/products/vendor/analytics/export/?range=${range}`;
  };

  const load = () => {
    setError("");
    setData(null);
    api.get(buildUrl())
      .then(setData)
      .catch(() => setError("Couldn't load analytics. Please refresh."));
  };

  useEffect(() => {
    if (range !== "custom") load();
  }, [range]);

  const handleCustomApply = (e) => {
    e.preventDefault();
    if (fromDate && toDate && fromDate <= toDate) load();
  };

  const totalViews = data?.total_views ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-heading">Analytics</h2>
          <p className="text-sm text-gray-500">Revenue, views and conversion for your storefront.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${range === r.value ? "bg-brand text-white" : "border border-gray-300 text-gray-600 hover:border-brand"}`}
            >
              {r.value === "custom" ? <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Custom</span> : r.label}
            </button>
          ))}
          <button onClick={load} aria-label="Refresh analytics" className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm font-medium text-gray-600 hover:border-brand hover:text-brand">
            <RefreshCw className="h-4 w-4" />
          </button>
          <a
            href={buildExportUrl()}
            download
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm font-medium text-gray-600 hover:border-brand hover:text-brand"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </div>
      </div>

      {range === "custom" && (
        <form onSubmit={handleCustomApply} className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div>
            <label htmlFor="analytics-from-date" className="block text-xs font-medium text-gray-600">From</label>
            <input
              id="analytics-from-date"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="analytics-to-date" className="block text-xs font-medium text-gray-600">To</label>
            <input
              id="analytics-to-date"
              type="date"
              value={toDate}
              min={fromDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!fromDate || !toDate || fromDate > toDate}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Apply
          </button>
          {fromDate > toDate && (
            <p className="text-xs text-red-500">&quot;From&quot; must be before &quot;To&quot;</p>
          )}
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!data ? (
        range === "custom" && !error ? (
          <p className="mt-6 text-sm text-gray-400">Select a date range and click Apply.</p>
        ) : (
          <AnalyticsSkeleton />
        )
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
            <div className="rounded-xl border border-gray-100 bg-surface p-4 shadow-sm">
              <h3 className="text-sm font-bold text-heading">Top Products</h3>
              {data.top_products.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">No sales in this range yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {data.top_products.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <span className="truncate text-gray-700">{p.name}</span>
                      <span className="ml-2 shrink-0 font-medium text-heading">{formatPKR(p.revenue)} <span className="text-xs text-gray-400">({p.units} units)</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-100 bg-surface p-4 shadow-sm">
              <h3 className="text-sm font-bold text-heading">Traffic Sources</h3>
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


