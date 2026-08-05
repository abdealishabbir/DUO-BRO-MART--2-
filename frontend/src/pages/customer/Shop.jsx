import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, SlidersHorizontal, Grid2x2, List, X, Star } from "lucide-react";
import { api } from "../../lib/api.js";
import { useCart } from "../../cart/CartContext.jsx";
import { formatPKR } from "../../lib/currency.js";
import WishlistButton from "../../components/WishlistButton.jsx";
import Meta from "../../components/Meta.jsx";

const DEFAULT_FILTERS = { categories: [], brands: [], minPrice: "", maxPrice: "", dealsOnly: false, minRating: "", search: "" };

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
    dealsOnly: params.get("deals") === "1",
    minRating: params.get("minRating") ?? "",
    search: params.get("search") ?? "",
  };
}

function paramsFromState({ filters, sort, view, page }) {
  const params = {};
  if (filters.categories.length) params.categories = filters.categories.join(",");
  if (filters.brands.length) params.brands = filters.brands.join(",");
  if (filters.minPrice) params.minPrice = filters.minPrice;
  if (filters.maxPrice) params.maxPrice = filters.maxPrice;
  if (filters.dealsOnly) params.deals = "1";
  if (filters.minRating) params.minRating = filters.minRating;
  if (filters.search) params.search = filters.search;
  if (sort !== "newest") params.sort = sort;
  if (view !== "grid") params.view = view;
  if (page !== 1) params.page = String(page);
  return params;
}

function FiltersSidebar({ filters, setFilters, categories, brands }) {
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
          {categories.map((cat) => (
            <li key={cat.id}>
              <label className="flex items-center gap-2 text-gray-700">
                <input type="checkbox" checked={filters.categories.includes(cat.slug)} onChange={() => toggleInArray("categories", cat.slug)} />
                {cat.name}
              </label>
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
        <h4 className="mb-2 text-sm font-semibold text-gray-700">Minimum Rating</h4>
        <div className="flex flex-wrap gap-1.5">
          {[4, 3, 2, 1].map((n) => (
            <button
              key={n}
              onClick={() => setFilters((f) => ({ ...f, minRating: f.minRating === String(n) ? "" : String(n) }))}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                filters.minRating === String(n) ? "border-brand bg-brand text-white" : "border-gray-300 text-gray-600 hover:border-brand"
              }`}
            >
              <Star className={`h-3 w-3 ${filters.minRating === String(n) ? "fill-white" : "fill-gold text-gold"}`} /> {n}+
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-700">Brands</h4>
        <ul className="space-y-1.5 text-sm">
          {brands.map((brand) => (
            <li key={brand}>
              <label className="flex items-center gap-2 text-gray-700">
                <input type="checkbox" checked={filters.brands.includes(brand)} onChange={() => toggleInArray("brands", brand)} />
                {brand}
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
function ActiveFilterChips({ filters, setFilters, categories }) {
  const chips = [];

  if (filters.dealsOnly) {
    chips.push({ key: "deals", label: "On Sale", onRemove: () => setFilters((f) => ({ ...f, dealsOnly: false })) });
  }

  filters.categories.forEach((slug) => {
    const label = categories.find((c) => c.slug === slug)?.name ?? slug;
    chips.push({
      key: `cat-${slug}`,
      label,
      onRemove: () => setFilters((f) => ({ ...f, categories: f.categories.filter((c) => c !== slug) })),
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
    chips.push({ key: "price", label, onRemove: () => setFilters((f) => ({ ...f, minPrice: "", maxPrice: "" })) });
  }

  if (filters.minRating) {
    chips.push({ key: "rating", label: `${filters.minRating}+ stars`, onRemove: () => setFilters((f) => ({ ...f, minRating: "" })) });
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

export function ProductCard({ product, view }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const isList = view === "list";

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Link
      to={`/product/${product.slug}`}
      className={`rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md ${isList ? "flex items-center gap-4" : ""}`}
    >
      <div className={`relative ${isList ? "w-40 shrink-0" : ""}`}>
        {product.is_deal_active && (
          <span className="absolute left-0 top-0 rounded-br-md rounded-tl-md bg-ink px-2 py-0.5 text-xs font-bold text-white">Sale</span>
        )}
        <div className="absolute right-1.5 top-1.5 z-10">
          <WishlistButton product={product} />
        </div>
        <img
          src={product.images[0] || "https://placehold.co/300x300?text=No+Image"}
          alt={product.name}
          className={`w-full rounded-md object-cover ${isList ? "h-28" : "h-48"}`}
        />
      </div>
      <div className={isList ? "flex-1" : "mt-3"}>
        <p className="text-xs font-medium text-brand">{product.category_name}</p>
        <p className="mt-0.5 font-semibold text-gray-900">{product.name}</p>
        {product.rating_count > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {product.average_rating}
            <span className="text-gray-400">({product.rating_count})</span>
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <p>
            <span className="font-bold text-gray-900">{formatPKR(product.price)}</span>{" "}
            {product.original_price && <span className="text-xs text-gray-400 line-through">{formatPKR(product.original_price)}</span>}
          </p>
          <button onClick={handleAdd} className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink">
            {added ? "Added ✓" : "Add to Cart"}
          </button>
        </div>
      </div>
    </Link>
  );
}

export function Pagination({ page, totalPages, onChange }) {
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

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Keep the URL in sync whenever any control changes, so the current
  // page/filters/sort/view are always shareable and survive a refresh.
  useEffect(() => {
    setSearchParams(paramsFromState({ filters, sort, view, page }), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, view, page]);

  useEffect(() => {
    api.get("/products/categories/").then((data) => setCategories(data.results ?? data));
    api.get("/products/brands/").then(setBrands);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", page);
    if (filters.categories.length) params.set("category", filters.categories.join(","));
    if (filters.brands.length) params.set("brand", filters.brands.join(","));
    if (filters.minPrice) params.set("min_price", filters.minPrice);
    if (filters.maxPrice) params.set("max_price", filters.maxPrice);
    if (filters.dealsOnly) params.set("deals", "1");
    if (filters.minRating) params.set("min_rating", filters.minRating);
    if (filters.search) params.set("search", filters.search);
    if (sort !== "newest") params.set("sort", sort);

    api.get(`/products/?${params.toString()}`).then((data) => {
      setItems(data.results ?? data);
      setCount(data.count ?? (data.results ?? data).length);
      setLoading(false);
    });
  }, [filters, sort, page]);

  const totalPages = Math.max(1, Math.ceil(count / 20));

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
      <Meta title="Shop — Duo Bro Mart" description="Browse products across categories on Duo Bro Mart — filter, sort, and find best deals." url={`${window.location.origin}/shop`} />
      <div className="mx-auto max-w-7xl px-4 pt-4 text-sm text-gray-500 lg:px-8">
        <Link to="/" className="hover:text-brand">Home</Link> <span className="mx-1">/</span> <span className="text-gray-900">Shop</span>
      </div>

      {filters.search && (
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 pt-3 lg:px-8">
          <p className="text-sm text-gray-600">
            Search results for <strong className="text-gray-900">&quot;{filters.search}&quot;</strong>
          </p>
          <button
            onClick={() => updateFilters((f) => ({ ...f, search: "" }))}
            className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-red-500"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <FiltersSidebar filters={filters} setFilters={updateFilters} categories={categories} brands={brands} />

          <div className="flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-sm text-gray-600">
                Showing <strong>{items.length}</strong> of <strong>{count}</strong> products
              </p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  Sort by:
                  <select className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                    <option value="newest">Newest Arrivals</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="rating">Highest Rated</option>
                  </select>
                </label>
                <div className="flex gap-1 rounded-md border border-gray-300 p-1">
                  <button onClick={() => setView("grid")} aria-label="Grid view" aria-pressed={view === "grid"} className={`rounded p-1 ${view === "grid" ? "bg-brand text-white" : "text-gray-500"}`}>
                    <Grid2x2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setView("list")} aria-label="List view" aria-pressed={view === "list"} className={`rounded p-1 ${view === "list" ? "bg-brand text-white" : "text-gray-500"}`}>
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <ActiveFilterChips filters={filters} setFilters={updateFilters} categories={categories} />

            {loading ? (
              <p className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Loading...</p>
            ) : items.length === 0 ? (
              <p className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
                No products match these filters. Try adjusting them.
              </p>
            ) : (
              <div className={view === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-4"}>
                {items.map((p) => <ProductCard key={p.id} product={p} view={view} />)}
              </div>
            )}

            <Pagination page={page} totalPages={totalPages} onChange={changePage} />
          </div>
        </div>
      </section>
    </div>
  );
}
