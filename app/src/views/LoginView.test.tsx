import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginView from "@/views/LoginView";
import { useAuthStore } from "@/stores/auth";
import type { AuthResponse, User } from "@neon-dusk/shared";

const mocks = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAccessToken: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  api: mocks.api,
  setAccessToken: mocks.setAccessToken,
  ApiError: class extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

const user: User = {
  id: "u1",
  email: "fixer@neondusk.gg",
  role: "player",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const authResponse: AuthResponse = {
  accessToken: "at",
  refreshToken: "rt",
  user,
  character: null,
};

function renderLogin(entry = "/login") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="/dashboard" element={<div>DASHBOARD PAGE</div>} />
        <Route path="/create-character" element={<div>CREATE CHARACTER PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("voce@neondusk.gg"), email);
  await user.type(screen.getByPlaceholderText("••••••••"), password);
  await user.click(screen.getByRole("button", { name: "ENTRAR" }));
}

describe("LoginView", () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState());
    mocks.api.post.mockReset();
    mocks.setAccessToken.mockReset();
  });

  it("should render the form, heading and register link", () => {
    renderLogin();

    expect(screen.getByText("ACESSO RESTRITO")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("voce@neondusk.gg")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ENTRAR" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cadastre-se" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("should log in and navigate to the dashboard on success", async () => {
    mocks.api.post.mockResolvedValue(authResponse);
    renderLogin();

    await fillAndSubmit("fixer@neondusk.gg", "secret123");

    expect(await screen.findByText("DASHBOARD PAGE")).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe("at");
    expect(useAuthStore.getState().user?.email).toBe("fixer@neondusk.gg");
    expect(mocks.api.post).toHaveBeenCalledWith("/api/auth/login", {
      email: "fixer@neondusk.gg",
      password: "secret123",
    });
    expect(mocks.setAccessToken).toHaveBeenCalledWith("at");
  });

  it("should honor the ?redirect= query param after login", async () => {
    mocks.api.post.mockResolvedValue(authResponse);
    renderLogin("/login?redirect=%2Fcreate-character");

    await fillAndSubmit("fixer@neondusk.gg", "secret123");

    expect(await screen.findByText("CREATE CHARACTER PAGE")).toBeInTheDocument();
  });

  it("should show the error message and stay on the page when login fails", async () => {
    mocks.api.post.mockRejectedValue(new Error("Credenciais inválidas"));
    renderLogin();

    await fillAndSubmit("fixer@neondusk.gg", "wrong");

    // ErrorState banner (design system) — role="alert" with a ✗ prefix.
    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas");
    expect(screen.getByRole("button", { name: "ENTRAR" })).toBeInTheDocument();
    expect(screen.queryByText("DASHBOARD PAGE")).not.toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("should show a loading button (aria-busy, disabled, spinner) while login is pending", async () => {
    mocks.api.post.mockReturnValue(new Promise(() => {}));
    renderLogin();

    await fillAndSubmit("fixer@neondusk.gg", "secret123");

    const submit = screen.getByRole("button", { name: "CONECTANDO..." });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(submit.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
