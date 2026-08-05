import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Store, Star, PackageSearch, CalendarDays } from "lucide-react";
import { api } from "../../lib/api.js";
import { ProductCard, Pagination } from "./Shop.jsx";
import Meta from "../../components/Meta.jsx";

const PAGE_SIZE = 20; // matches DEFAULT_PAGINATION_CLASS PAGE_SIZE (config/settings.py)

function StorefrontSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-8 lg:px-8">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-gray-200" />
        <div className="space-y-2">
          <div className="h-5 w-48 rounded bg-gray-200" />
          <div className="h-3 w-32 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <Store className="mx-auto h-12 w-12 text-gray-300" />
      <h1 className="mt-4 text-xl font-bold text-gray-900">Shop not found</h1>
      <p className="mt-2 text-sm text-gray-500">
        This vendor doesn&apos;t exist, or their storefront isn&apos;t currently available.
      </p>
      <Link to="/shop" className="mt-5 inline-block rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
        Browse All Products
      </Link>
    </div>
  );
}

export default function VendorStorefront() {
  const { vendorId } = useParams();
  const [store, setStore] = useState(null); // undefined-ish states: null=loading, "not-found", or the object
  const [notFound, setNotFound] = useState(false);
  const [products, setProducts] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("newest");
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    setStore(null);
    setNotFound(false);
    api
      .get(`/accounts/vendors/${vendorId}/store/`)
      .then(setStore)
      .catch((err) => {
        if (err.status === 404) setNotFound(true);
      });
  }, [vendorId]);

  useEffect(() => {
    if (notFound) return;
    setProductsLoading(true);
    const params = new URLSearchParams({ vendor: vendorId, page: String(page), page_size: String(PAGE_SIZE) });
    if (sort !== "newest") params.set("sort", sort);
    api
      .get(`/products/?${params.toString()}`)
      .then((data) => {
        setProducts(data.results);
        setTotalPages(Math.max(1, Math.ceil(data.count / PAGE_SIZE)));
      })
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  }, [vendorId, page, sort, notFound]);

  useEffect(() => {
    setPage(1);
  }, [vendorId, sort]);

  if (notFound) return <NotFound />;
  if (!store) return <StorefrontSkeleton />;

  const memberSinceYear = new Date(store.member_since).getFullYear();

  const storeUrl = `${window.location.origin}/store/${store.id}`;

  return (
    <div className="bg-gray-50">
      <Meta title={store.shop_name} description={store.shop_description} url={storeUrl} image={store.shop_logo} />
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center lg:px-8">
          {store.shop_logo ? (
            <img src={store.shop_logo} alt={store.shop_name} className="h-20 w-20 shrink-0 rounded-full border border-gray-200 object-cover" />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand/10">
              <Store className="h-9 w-9 text-brand" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900">{store.shop_name}</h1>
            {store.shop_description && <p className="mt-1 max-w-2xl text-sm text-gray-600">{store.shop_description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              {store.rating !== null && (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {store.rating} rating
                </span>
              )}
              <span className="flex items-center gap-1">
                <PackageSearch className="h-3.5 w-3.5" /> {store.product_count} product{store.product_count !== 1 && "s"}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Selling since {memberSinceYear}
              </span>
            </div>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Products from this shop</h2>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>

        {productsLoading ? (
          <p className="mt-10 text-center text-sm text-gray-400">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="mt-10 text-center text-sm text-gray-400">This shop hasn&apos;t listed any products yet.</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} view="grid" />
              ))}
            </div>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
          </>
        )}
      </section>
    </div>
  );
}
