import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RouteErrorBoundary from "../RouteErrorBoundary.jsx";

function Bomb() {
  throw new Error("Simulated render crash");
}

function Fine() {
  return <p>Everything is fine</p>;
}

// React logs the error boundary's caught error to the console by
// design (in addition to componentDidCatch) — silence it so a passing
// test doesn't print a scary stack trace, without hiding a genuine
// unrelated console.error from a different assertion.
const originalConsoleError = console.error;

describe("RouteErrorBoundary", () => {
  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("renders children normally when nothing throws", () => {
    render(
      <RouteErrorBoundary>
        <Fine />
      </RouteErrorBoundary>
    );
    expect(screen.getByText("Everything is fine")).toBeInTheDocument();
  });

  it("catches a render error and shows the fallback instead of crashing the whole tree", () => {
    console.error = vi.fn();
    render(
      <RouteErrorBoundary>
        <Bomb />
      </RouteErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.queryByText("Everything is fine")).not.toBeInTheDocument();
  });

  it("offers a way back to a working page (Go home link) from the fallback", () => {
    console.error = vi.fn();
    render(
      <RouteErrorBoundary>
        <Bomb />
      </RouteErrorBoundary>
    );
    const homeLink = screen.getByRole("link", { name: /go home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("'Try again' actually attempts to re-render the children rather than being a no-op button", async () => {
    console.error = vi.fn();
    const user = userEvent.setup();

    // React 18 dev mode re-invokes a throwing render once internally to
    // get a cleaner stack trace before calling componentDidCatch, so a
    // component that flips a flag on its own call count isn't a reliable
    // way to test "recovery" — instead, just confirm clicking the button
    // causes the children to be attempted again at all (an always-crashing
    // component's render function gets called more times after the click).
    let renderAttempts = 0;
    function AlwaysBomb() {
      renderAttempts += 1;
      throw new Error("Always fails");
    }

    render(
      <RouteErrorBoundary>
        <AlwaysBomb />
      </RouteErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    const attemptsBeforeRetry = renderAttempts;

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(renderAttempts).toBeGreaterThan(attemptsBeforeRetry);
    // Still crashing (AlwaysBomb never stops throwing), so the fallback
    // correctly stays visible rather than silently showing a blank page.
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});
