import { useEffect, useRef } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// Derives ws(s)://host/ws/inventory/ from the same base URL api.js uses,
// so there's one place (VITE_API_BASE_URL) that decides the backend host.
function inventoryWsUrl() {
  const apiUrl = new URL(API_BASE_URL);
  const scheme = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${apiUrl.host}/ws/inventory/`;
}

/**
 * §7.1: subscribes to the shared inventory broadcast and calls onUpdate
 * for every message. Silently no-ops on connection failure — a live
 * stock badge is a nice-to-have, not something that should ever break
 * the page if the WebSocket can't connect (e.g. dev environment not
 * running the ASGI server yet).
 */
export function useInventorySocket(onUpdate) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    let socket;
    try {
      socket = new WebSocket(inventoryWsUrl());
      socket.onmessage = (event) => {
        try {
          callbackRef.current(JSON.parse(event.data));
        } catch {
          // ignore malformed messages
        }
      };
      socket.onerror = () => {}; // swallow — this is a best-effort enhancement
    } catch {
      // WebSocket not available/reachable — page still works without live updates
    }
    return () => socket?.close();
  }, []);
}
