import { mockApi } from "./mockApi.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// Demo/deploy-preview mode — set VITE_MOCK_MODE=true in Vercel's env vars
// when there's no real backend deployed yet. Every request below then
// answers from mockApi.js (static catalog data + a fake localStorage
// session) instead of hitting `${API_BASE_URL}`. This is the ONLY place
// that decides mock vs. real — remove the env var (or set it to anything
// else) once VITE_API_BASE_URL points at a real backend, and everything
// reverts to normal with no other code changes needed.
const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === "true";

let refreshInFlight = null;

async function rawRequest(path, options) {
  return fetch(`${API_BASE_URL}${path}`, {
    credentials: "include", // send/receive the HttpOnly JWT cookies (§4.4.3)
    cache: "no-store", // never serve a stale response from the browser's HTTP cache —
    // without this, clicking a "Refresh" button (or any GET re-fetch) could silently
    // return old data until a full page reload forced a real network request.
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
}

// Multipart requests must NOT set Content-Type manually — the browser needs
// to set it itself (with the correct boundary) when the body is FormData.
async function rawFormRequest(path, options) {
  return fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...options,
  });
}

async function refreshAccessToken() {
  // Coalesce concurrent 401s into a single refresh call instead of one per request.
  if (!refreshInFlight) {
    refreshInFlight = rawRequest("/auth/refresh/", { method: "POST" }).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * api.request("/auth/login/", { method: "POST", body: {...} })
 * Throws an ApiError with .status and .data (the parsed JSON error body) on failure.
 */
async function request(path, { method = "GET", body, skipRefresh = false } = {}) {
  if (MOCK_MODE) return mockApi.request(path, method, body);

  let response = await rawRequest(path, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !skipRefresh && path !== "/auth/refresh/") {
    const refreshResponse = await refreshAccessToken();
    if (refreshResponse.ok) {
      response = await rawRequest(path, {
        method,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    }
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(data?.detail || "Request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function requestForm(path, { method = "POST", formData }) {
  if (MOCK_MODE) {
    // File-upload flows (vendor application docs, feedback photos, etc.)
    // aren't part of the browse/search/checkout demo scope — succeed
    // with an empty response rather than hard-failing on a real fetch()
    // that has nowhere real to go.
    await new Promise((r) => setTimeout(r, 300));
    return {};
  }

  let response = await rawFormRequest(path, { method, body: formData });

  if (response.status === 401) {
    const refreshResponse = await rawRequest("/auth/refresh/", { method: "POST" });
    if (refreshResponse.ok) {
      response = await rawFormRequest(path, { method, body: formData });
    }
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(data?.detail || "Request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts) => request(path, { method: "POST", body, ...opts }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  postForm: (path, formData) => requestForm(path, { method: "POST", formData }),
  patchForm: (path, formData) => requestForm(path, { method: "PATCH", formData }),
};
