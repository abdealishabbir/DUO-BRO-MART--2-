import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, SlidersHorizontal, Star, Grid2x2, List, X } from "lucide-react";
import { PRODUCTS, getCategoryCounts, BRANDS } from "../../data/productsMockData.js";
import { useCart } from "../../cart/CartContext.jsx";
import { formatPKR } from "../../lib/currency.js";

const PAGE_SIZE = 9;

const DEFAULT_FILTERS = { categories: [], brands: [], minPrice: "", maxPrice: "", minRating: 0, dealsOnly: false };

// PRD §14.9.C: pagination (and filters) must appear in the URL, and
// active filters must render as removable chips. These helpers keep
// the URL and the filters/sort/view/page state in sync both ways —
// reading a shared link restores the exact same view, and changing
// any control updates the URL without a full navigation.
function filtersFromParams(params) {
  return {
    categories: params.get("categories") ? params.get("categories").split(",") : [],
    brands: params.get("brands") ? params.get("brands").split(",") : [],
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    minRating: params.get("minRating") ? Number(params.get("minRating")) : 0,
    dealsOnly: params.get("deals") === "1",
  };
}

function paramsFromState({ filters, sort, view, page }) {
  const params = {};
  if (filters.categories.length) params.categories = filters.categories.join(",");
  if (filters.brands.length) params.brands = filters.brands.join(",");
  if (filters.minPrice) params.minPrice = filters.minPrice;
  if (filters.maxPrice) params.maxPrice = filters.maxPrice;
  if (filters.minRating) params.minRating = String(filters.minRating);
  if (filters.dealsOnly) params.deals = "1";
  if (sort !== "newest") params.sort = sort;
  if (view !== "grid") params.view = view;
  if (page !== 1) params.page = String(page);
  return params;
}

function StarRating({ rating, count }) {
  return (
    <p className="flex items-center gap-1 text-xs text-gray-500">
      <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {rating} {count != null && <span className="text-gray-400">({count})</span>}
    </p>
  );
}

function FiltersSidebar({ filters, setFilters, categoryCounts }) {
  const toggleInArray = (key, value) => {
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));
  };

  return (
    <aside className="w-full shrink-0 space-y-6 lg:w-64">
      <div>
        <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </h3>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-700">Deals</h4>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={filters.dealsOnly} onChange={() => setFilters((f) => ({ ...f, dealsOnly: !f.dealsOnly }))} />
          On Sale Only
        </label>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-700">Categories</h4>
        <ul className="space-y-1.5 text-sm">
          {categoryCounts.map((cat) => (
            <li key={cat.id} className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-gray-700">
                <input type="checkbox" checked={filters.categories.includes(cat.id)} onChange={() => toggleInArray("categories", cat.id)} />
                {cat.label}
              </label>
              <span className="text-xs text-gray-400">{cat.count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-700">Price Range (PKR)</h4>
        <div className="flex items-center gap-2">
          <input
            type="number" placeholder="Min" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            value={filters.minPrice} onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
          />
          <span className="text-gray-400">-</span>
          <input
            type="number" placeholder="Max" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            value={filters.maxPrice} onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-700">Brands</h4>
        <ul className="space-y-1.5 text-sm">
          {BRANDS.map((brand) => (
            <li key={brand}>
              <label className="flex items-center gap-2 text-gray-700">
                <input type="checkbox" checked={filters.brands.includes(brand)} onChange={() => toggleInArray("brands", brand)} />
                {brand}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-700">Rating</h4>
        <ul className="space-y-1.5 text-sm">
          {[5, 4, 3].map((r) => (
            <li key={r}>
              <label className="flex items-center gap-2 text-gray-700">
                <input type="radio" name="rating" checked={filters.minRating === r} onChange={() => setFilters((f) => ({ ...f, minRating: f.minRating === r ? 0 : r }))} />
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: r }, (_, i) => <Star key={i} className="h-3.5 w-3.5 fill-gold text-gold" />)}
                </span>
                &amp; Up
              </label>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

// PRD §14.9.C: active filters render as removable chips above the
// results, each with its own "x" to clear just that one filter.
function ActiveFilterChips({ filters, setFilters, categoryCounts }) {
  const chips = [];

  if (filters.dealsOnly) {
    chips.push({
      key: "deals",
      label: "On Sale",
      onRemove: () => setFilters((f) => ({ ...f, dealsOnly: false })),
    });
  }

  filters.categories.forEach((catId) => {
    const label = categoryCounts.find((c) => c.id === catId)?.label ?? catId;
    chips.push({
      key: `cat-${catId}`,
      label,
      onRemove: () => setFilters((f) => ({ ...f, categories: f.categories.filter((c) => c !== catId) })),
    });
  });

  filters.brands.forEach((brand) => {
    chips.push({
      key: `brand-${brand}`,
      label: brand,
      onRemove: () => setFilters((f) => ({ ...f, brands: f.brands.filter((b) => b !== brand) })),
    });
  });

  if (filters.minPrice || filters.maxPrice) {
    const label = `${filters.minPrice ? formatPKR(filters.minPrice) : "PKR 0"} - ${filters.maxPrice ? formatPKR(filters.maxPrice) : "Any"}`;
    chips.push({
      key: "price",
      label,
      onRemove: () => setFilters((f) => ({ ...f, minPrice: "", maxPrice: "" })),
    });
  }

  if (filters.minRating) {
    chips.push({
      key: "rating",
      label: `${filters.minRating}★ & Up`,
      onRemove: () => setFilters((f) => ({ ...f, minRating: 0 })),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span key={chip.key} className="flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700">
          {chip.label}
          <button onClick={chip.onRemove} aria-label={`Remove ${chip.label} filter`} className="text-gray-400 hover:text-red-600">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button onClick={() => setFilters(() => DEFAULT_FILTERS)} className="text-xs font-medium text-brand hover:underline">
        Clear all
      </button>
    </div>
  );
}

function ProductCard({ product, view }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const isList = view === "list";

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product.slug, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Link
      to={`/product/${product.slug}`}
      className={`rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md ${isList ? "flex items-center gap-4" : ""}`}
    >
      <div className={`relative ${isList ? "w-40 shrink-0" : ""}`}>
        {product.badge === "sale" && (
          <span className="absolute left-0 top-0 rounded-br-md rounded-tl-md bg-ink px-2 py-0.5 text-xs font-bold text-white">Sale</span>
        )}
        <img src={product.images[0]} alt={product.name} className={`w-full rounded-md object-cover ${isList ? "h-28" : "h-48"}`} />
      </div>
      <div className={isList ? "flex-1" : "mt-3"}>
        <p className="text-xs font-medium text-brand">{product.categoryLabel}</p>
        <p className="mt-0.5 font-semibold text-gray-900">{product.name}</p>
        <StarRating rating={product.rating} count={product.reviewCount} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p>
            <span className="font-bold text-gray-900">{formatPKR(product.price)}</span>{" "}
            {product.originalPrice && <span className="text-xs text-gray-400 line-through">{formatPKR(product.originalPrice)}</span>}
          </p>
          <button onClick={handleAdd} className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink">
            {added ? "Added ✓" : "Add to Cart"}
          </button>
        </div>
      </div>
    </Link>
  );
}

function Pagination({ page, totalPages, onChange }) {
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }
  return (
    <div className="mt-8 flex items-center justify-center gap-2">
      <button disabled={page === 1} onClick={() => onChange(page - 1)} className="rounded-md border border-gray-300 p-2 disabled:opacity-40">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-1 text-gray-400">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`h-9 w-9 rounded-md text-sm font-semibold ${p === page ? "bg-brand text-white" : "border border-gray-300 text-gray-700 hover:border-brand"}`}
          >
            {p}
          </button>
        )
      )}
      <button disabled={page === totalPages} onClick={() => onChange(page + 1)} className="rounded-md border border-gray-300 p-2 disabled:opacity-40">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState(() => filtersFromParams(searchParams));
  const [sort, setSort] = useState(() => searchParams.get("sort") ?? "newest");
  const [view, setView] = useState(() => searchParams.get("view") ?? "grid");
  const [page, setPage] = useState(() => Number(searchParams.get("page") ?? 1));

  // Keep the URL in sync whenever any control changes, so the current
  // page/filters/sort/view are always shareable and survive a refresh.
  useEffect(() => {
    setSearchParams(paramsFromState({ filters, sort, view, page }), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, view, page]);

  const categoryCounts = useMemo(getCategoryCounts, []);

  const filtered = useMemo(() => {
    let list = PRODUCTS.filter((p) => {
      if (filters.dealsOnly && p.badge !== "sale") return false;
      if (filters.categories.length && !filters.categories.includes(p.category)) return false;
      if (filters.brands.length && !filters.brands.includes(p.brand)) return false;
      if (filters.minPrice && p.price < Number(filters.minPrice)) return false;
      if (filters.maxPrice && p.price > Number(filters.maxPrice)) return false;
      if (filters.minRating && p.rating < filters.minRating) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [filters, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateFilters = (fn) => {
    setFilters(fn);
    setPage(1);
  };

  const changePage = (p) => {
    setPage(p);
    window.scrollTo({ top: 300, behavior: "smooth" });
  };

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 pt-4 text-sm text-gray-500 lg:px-8">
        <Link to="/" className="hover:text-brand">Home</Link> <span className="mx-1">/</span> <span className="text-gray-900">Shop</span>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <FiltersSidebar filters={filters} setFilters={updateFilters} categoryCounts={categoryCounts} />

          <div className="flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-sm text-gray-600">
                Showing <strong>{filtered.length}</strong> products
              </p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  Sort by:
                  <select className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                    <option value="newest">Newest Arrivals</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="rating">Best Rated</option>
                  </select>
                </label>
                <div className="flex gap-1 rounded-md border border-gray-300 p-1">
                  <button onClick={() => setView("grid")} className={`rounded p-1 ${view === "grid" ? "bg-brand text-white" : "text-gray-500"}`}>
                    <Grid2x2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setView("list")} className={`rounded p-1 ${view === "list" ? "bg-brand text-white" : "text-gray-500"}`}>
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <ActiveFilterChips filters={filters} setFilters={updateFilters} categoryCounts={categoryCounts} />

            {pageItems.length === 0 ? (
              <p className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
                No products match these filters. Try adjusting them.
              </p>
            ) : (
              <div className={view === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-4"}>
                {pageItems.map((p) => <ProductCard key={p.id} product={p} view={view} />)}
              </div>
            )}

            <Pagination page={page} totalPages={totalPages} onChange={changePage} />
          </div>
        </div>
      </section>
    </div>
  );
}
