import { Component } from "react";
import { AlertTriangle } from "lucide-react";
import Button, { buttonClasses } from "./Button.jsx";

/**
 * Wraps <Outlet /> in each layout (Customer/Vendor/Admin) so a bug in one
 * page's render — a null-check miss, a bad API shape, anything — shows a
 * recoverable fallback in the content area instead of a fully blank white
 * screen with the header/nav gone too. This is exactly the class of bug
 * that produced the blank Admin Settings page earlier in this project: a
 * component threw during render and nothing caught it.
 *
 * React only supports error boundaries via a class component's
 * getDerivedStateFromError/componentDidCatch — there's no hook
 * equivalent (as of React 18), so this has to be a class despite the
 * rest of the app being function components.
 *
 * The parent layout renders this with `key={location.pathname}` so that
 * navigating to a *different* route remounts the boundary and clears any
 * previous crash — without that, a user who crashes on /account and then
 * clicks to /shop would still see the old error screen instead of the
 * new page, because class state doesn't reset on prop changes alone.
 */
export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // No error-tracking service wired up yet (see DEFERRED_ITEMS.md) —
    // console.error is the only record of this today. Swap/add a real
    // reporting call here once one exists.
    console.error("RouteErrorBoundary caught:", error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="font-display mt-4 text-lg font-bold text-gray-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-500">
          This page hit an unexpected error. It&apos;s been logged — try reloading, or head back home.
        </p>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => this.setState({ hasError: false })}>Try again</Button>
          {/* A real <a href> here (not <Link>) is deliberate — a full
             browser reload guarantees a clean slate even if the crash
             came from corrupted shared state (Cart/Auth context) that a
             client-side route change alone wouldn't reset. */}
          <a href="/" className={buttonClasses({ variant: "secondary" })}>Go home</a>
        </div>
      </div>
    );
  }
}
