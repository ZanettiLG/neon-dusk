import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RegisterView from "@/views/RegisterView";
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
  email: "new@neondusk.gg",
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

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterView />} />
        <Route path="/dashboard" element={<div>DASHBOARD PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillAndSubmit(email: string, password: string, confirm: string) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("fixer@neondusk.gg"), email);
  await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), password);
  await user.type(screen.getByPlaceholderText("Repita a senha"), confirm);
  await user.click(screen.getByRole("button", { name: "CADASTRAR" }));
}

describe("RegisterView", () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState());
    mocks.api.post.mockReset();
  });

  it("should render the form, heading and login link", () => {
    renderRegister();

    expect(screen.getByText("CRIAR PERFIL")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("fixer@neondusk.gg")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Mínimo 8 caracteres")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Repita a senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CADASTRAR" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  it("should disable submit until email, password and confirm are valid", async () => {
    renderRegister();

    const submit = screen.getByRole("button", { name: "CADASTRAR" });
    expect(submit).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("fixer@neondusk.gg"), "new@neondusk.gg");
    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "secret123");
    await user.type(screen.getByPlaceholderText("Repita a senha"), "secret123");

    // No uppercase → still invalid.
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "S");
    await user.type(screen.getByPlaceholderText("Repita a senha"), "S");

    expect(submit).toBeEnabled();
  });

  it.each(["not-an-email", "a@b.c", "a@b..c"])(
    "should show an inline error for invalid email %s",
    async (invalidEmail) => {
      renderRegister();

      await userEvent
        .setup()
        .type(screen.getByPlaceholderText("fixer@neondusk.gg"), invalidEmail);

      expect(screen.getByRole("alert")).toHaveTextContent("E-mail inválido.");
      expect(screen.getByRole("button", { name: "CADASTRAR" })).toBeDisabled();
    },
  );

  it("should show an inline error for a short password", async () => {
    renderRegister();

    await userEvent.setup().type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "Ab1");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "A senha precisa de pelo menos 8 caracteres.",
    );
  });

  it("should show an inline error when the password lacks an uppercase letter or a digit", async () => {
    renderRegister();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "secretsss");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Inclua ao menos uma letra maiúscula.",
    );

    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "S");

    expect(screen.getByRole("alert")).toHaveTextContent("Inclua ao menos um número.");
  });

  it("should show a mismatch error and not call the API when passwords differ", async () => {
    renderRegister();

    await fillAndSubmit("new@neondusk.gg", "Secret123", "different");

    expect(await screen.findByText("As senhas não coincidem")).toBeInTheDocument();
    expect(mocks.api.post).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("should register and navigate to the dashboard on success", async () => {
    mocks.api.post.mockResolvedValue(authResponse);
    renderRegister();

    await fillAndSubmit("new@neondusk.gg", "Secret123", "Secret123");

    expect(await screen.findByText("DASHBOARD PAGE")).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe("at");
    expect(mocks.api.post).toHaveBeenCalledWith("/api/auth/register", {
      email: "new@neondusk.gg",
      password: "Secret123",
    });
  });

  it("should show the error message when registration fails", async () => {
    mocks.api.post.mockRejectedValue(new Error("Email já cadastrado"));
    renderRegister();

    await fillAndSubmit("new@neondusk.gg", "Secret123", "Secret123");

    expect(await screen.findByText("Email já cadastrado")).toBeInTheDocument();
    expect(screen.queryByText("DASHBOARD PAGE")).not.toBeInTheDocument();
  });
});
