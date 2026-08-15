import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// RTL doesn't auto-cleanup under Vitest the way it does under Jest —
// without this, a component left mounted by one test (e.g. one that
// never unmounts on success) leaks into the next test's DOM and can
// cause false-positive "found 2 elements" failures.
afterEach(() => {
  cleanup();
});

// CartContext/WishlistContext persist to localStorage; every test should
// start from a clean slate rather than inheriting state a previous test
// left behind (jsdom keeps localStorage alive for the whole test file
// otherwise, which is not how a real browser session works between
// separate test scenarios).
beforeEach(() => {
  window.localStorage.clear();
});
