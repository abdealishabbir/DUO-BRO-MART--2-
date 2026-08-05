import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Clock } from "lucide-react";
import { api } from "../lib/api.js";
import { formatPKR } from "../lib/currency.js";

const RECENT_SEARCHES_KEY = "dbm_recent_searches";
const MAX_RECENT = 5;
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term) {
  const trimmed = term.trim();
  if (!trimmed) return;
  const existing = loadRecentSearches().filter((t) => t.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...existing].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // localStorage can throw in private-browsing/quota-exceeded situations —
    // recent searches are a nicety, not worth breaking the search box over.
  }
  return next;
}

/**
 * Header search box with a live suggestions dropdown. Two things happen
 * on each keystroke: a debounced call to /products/search-suggestions/
 * (product + category matches), and — while the field is still short or
 * empty — a fallback to locally-stored recent searches so the dropdown
 * isn't just empty the instant someone clicks in.
 *
 * `onNavigate` lets the mobile menu close itself after a selection;
 * desktop usage can omit it.
 */
export default function SearchAutocomplete({ placeholder = "Search for products, brands and more...", onNavigate, className = "" }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ products: [], categories: [] });
  const [recent, setRecent] = useState(() => loadRecentSearches());
  const [highlightIndex, setHighlightIndex] = useState(-1);

  // Flattened list purely for keyboard navigation — order matches what's
  // actually rendered (categories, then products, then recent searches
  // when the query is empty).
  const flatItems = query.trim().length >= MIN_QUERY_LENGTH
    ? [
        ...results.categories.map((c) => ({ type: "category", ...c })),
        ...results.products.map((p) => ({ type: "product", ...p })),
        ...(results.categories.length > 0 || results.products.length > 0 ? [{ type: "all", term: query.trim() }] : []),
      ]
    : recent.map((term) => ({ type: "recent", term }));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    setHighlightIndex(-1);

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults({ products: [], categories: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      api
        .get(`/products/search-suggestions/?q=${encodeURIComponent(query.trim())}`)
        .then((data) => setResults(data))
        .catch(() => setResults({ products: [], categories: [] }))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const goToShop = (term) => {
    setRecent(saveRecentSearch(term) || recent);
    setOpen(false);
    setQuery("");
    navigate(`/shop?search=${encodeURIComponent(term)}`);
    onNavigate?.();
  };

  const goToProduct = (product) => {
    saveRecentSearch(query);
    setOpen(false);
    setQuery("");
    navigate(`/product/${product.slug}`);
    onNavigate?.();
  };

  const goToCategory = (category) => {
    setOpen(false);
    setQuery("");
    navigate(`/shop?categories=${category.slug}`);
    onNavigate?.();
  };

  const selectItem = (item) => {
    if (item.type === "product") goToProduct(item);
    else if (item.type === "category") goToCategory(item);
    else goToShop(item.term);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlightIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && flatItems[highlightIndex]) {
        selectItem(flatItems[highlightIndex]);
      } else if (query.trim()) {
        goToShop(query.trim());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const clearRecent = (e) => {
    e.stopPropagation();
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    setRecent([]);
  };

  const showDropdown = open && (query.trim().length >= MIN_QUERY_LENGTH || recent.length > 0);
  const activeDescendant = highlightIndex >= 0 ? `search-autocomplete-option-${highlightIndex}` : undefined;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Search products"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="search-autocomplete-list"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={activeDescendant}
        className="w-full rounded-full border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />

      {showDropdown && (
        <div id="search-autocomplete-list" role="listbox" aria-label="Search suggestions" className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {query.trim().length >= MIN_QUERY_LENGTH ? (
            loading ? (
              <p className="px-4 py-3 text-sm text-gray-400">Searching...</p>
            ) : flatItems.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">No matches for &quot;{query}&quot;</p>
            ) : (
              <>
                {results.categories.length > 0 && (
                  <div className="border-b border-gray-100 py-1">
                    {results.categories.map((c, i) => (
                      <button
                        key={c.slug}
                        id={`search-autocomplete-option-${i}`}
                        role="option"
                        aria-selected={highlightIndex === i}
                        onMouseDown={() => goToCategory(c)}
                        className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                          highlightIndex === i ? "bg-brand/5 text-brand" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <Search className="h-3.5 w-3.5 text-gray-400" />
                        in <span className="font-medium">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {results.products.length > 0 && (
                  <div className="py-1">
                    {results.products.map((p, i) => {
                      const idx = results.categories.length + i;
                      return (
                        <button
                          key={p.id}
                          id={`search-autocomplete-option-${idx}`}
                          role="option"
                          aria-selected={highlightIndex === idx}
                          onMouseDown={() => goToProduct(p)}
                          className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                            highlightIndex === idx ? "bg-brand/5" : "hover:bg-gray-50"
                          }`}
                        >
                          <img
                            src={p.image || "https://placehold.co/64x64?text=No+Image"}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded object-cover"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900">{p.name}</span>
                            <span className="block text-xs text-gray-400">{p.category_name}</span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold text-gray-900">{formatPKR(p.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  id={`search-autocomplete-option-${results.categories.length + results.products.length}`}
                  role="option"
                  aria-selected={highlightIndex === results.categories.length + results.products.length}
                  onMouseDown={() => goToShop(query.trim())}
                  className="block w-full border-t border-gray-100 px-4 py-2.5 text-left text-sm font-medium text-brand hover:bg-gray-50"
                >
                  See all results for &quot;{query.trim()}&quot;
                </button>
              </>
            )
          ) : (
            <div className="py-1">
              <div className="flex items-center justify-between px-4 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Recent Searches</span>
                <button onMouseDown={clearRecent} className="text-xs text-gray-400 hover:text-red-500">
                  Clear
                </button>
              </div>
              {recent.map((term, i) => (
                <button
                  key={term}
                  id={`search-autocomplete-option-${i}`}
                  role="option"
                  aria-selected={highlightIndex === i}
                  onMouseDown={() => goToShop(term)}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                    highlightIndex === i ? "bg-brand/5 text-brand" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
