import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils.jsx";
import Login from "../Login.jsx";
import { api } from "../../../lib/api.js";

vi.mock("../../../lib/api.js", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockRejectedValue({ status: 401 }); // no session on mount
});

describe("Login page", () => {
  it("submits email/password and sends them to the login endpoint", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ user: { id: 1, email: "ayesha@example.com", role: "customer" } });

    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/email/i), "ayesha@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/auth/login/",
        { email: "ayesha@example.com", password: "correct-horse-battery", keep_logged_in: false }
      );
    });
  });

  it("sends keep_logged_in: true when that checkbox is checked", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ user: { id: 1, email: "a@b.com", role: "customer" } });

    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/^password$/i), "hunter2hunter2");
    await user.click(screen.getByLabelText(/keep me logged in/i));
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/auth/login/",
        expect.objectContaining({ keep_logged_in: true })
      );
    });
  });

  it("shows the server's error message on invalid credentials instead of silently doing nothing", async () => {
    const user = userEvent.setup();
    const loginError = Object.assign(new Error("Request failed"), {
      data: { detail: "Invalid email or password." },
    });
    api.post.mockRejectedValue(loginError);

    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/email/i), "wrong@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "wrongpassword123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
  });

  it("falls back to a generic error message when the server response has no detail field", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new Error("network down"));

    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/^password$/i), "somepassword1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("disables the submit button and shows in-progress text while the request is in flight", async () => {
    const user = userEvent.setup();
    let resolveLogin;
    api.post.mockReturnValue(new Promise((resolve) => { resolveLogin = resolve; }));

    renderWithProviders(<Login />);
    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/^password$/i), "somepassword1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();

    resolveLogin({ user: { id: 1, email: "a@b.com", role: "customer" } });
  });
});
