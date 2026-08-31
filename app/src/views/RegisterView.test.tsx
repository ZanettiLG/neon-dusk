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
  await user.type(screen.getByPlaceholderText("voce@neondusk.gg"), email);
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
    expect(screen.getByPlaceholderText("voce@neondusk.gg")).toBeInTheDocument();
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
    await user.type(screen.getByPlaceholderText("voce@neondusk.gg"), "new@neondusk.gg");
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
        .type(screen.getByPlaceholderText("voce@neondusk.gg"), invalidEmail);

      // Inline field errors render inside ui/Input (no role="alert" — wired via
      // aria-invalid/aria-describedby), so match by text (✗ prefix is safe with regex).
      expect(screen.getByText(/E-mail inválido\./)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "CADASTRAR" })).toBeDisabled();
    },
  );

  it("should show an inline error for a short password", async () => {
    renderRegister();

    await userEvent.setup().type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "Ab1");

    expect(screen.getByText(/A senha precisa de pelo menos 8 caracteres\./)).toBeInTheDocument();
  });

  it("should show an inline error when the password lacks an uppercase letter or a digit", async () => {
    renderRegister();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "secretsss");

    expect(screen.getByText(/Inclua ao menos uma letra maiúscula\./)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "S");

    expect(screen.getByText(/Inclua ao menos um número\./)).toBeInTheDocument();
  });

  it("should show a mismatch error and not call the API when passwords differ", async () => {
    renderRegister();

    await fillAndSubmit("new@neondusk.gg", "Secret123", "different");

    expect(await screen.findByText(/As senhas não coincidem/)).toBeInTheDocument();
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

    // ErrorState banner (design system) — role="alert" with a ✗ prefix.
    expect(await screen.findByRole("alert")).toHaveTextContent("Email já cadastrado");
    expect(screen.queryByText("DASHBOARD PAGE")).not.toBeInTheDocument();
  });

  it("should wire aria-invalid and aria-describedby on the email field when invalid", async () => {
    renderRegister();

    await userEvent.setup().type(screen.getByPlaceholderText("voce@neondusk.gg"), "not-an-email");

    const input = screen.getByPlaceholderText("voce@neondusk.gg");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("E-mail inválido.");
  });

  it("should wire aria-invalid and aria-describedby on the password field when weak", async () => {
    renderRegister();

    await userEvent.setup().type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "Ab1");

    const input = screen.getByPlaceholderText("Mínimo 8 caracteres");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "A senha precisa de pelo menos 8 caracteres.",
    );
  });

  it("should wire aria-invalid and aria-describedby on the confirm field when passwords differ", async () => {
    renderRegister();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("voce@neondusk.gg"), "new@neondusk.gg");
    await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), "Secret123");
    await user.type(screen.getByPlaceholderText("Repita a senha"), "different");

    const input = screen.getByPlaceholderText("Repita a senha");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("As senhas não coincidem");
  });

  it("should cap the password input at 72 characters via maxLength", async () => {
    renderRegister();

    await userEvent.setup().type(
      screen.getByPlaceholderText("Mínimo 8 caracteres"),
      "A1" + "x".repeat(80),
    );

    // ui/Input forwards maxLength natively — typing beyond 72 is truncated, so
    // the "máximo 72" error branch is unreachable through the UI.
    expect(screen.getByPlaceholderText("Mínimo 8 caracteres")).toHaveValue("A1" + "x".repeat(70));
  });

  it("should show a loading button (aria-busy, disabled, spinner) while registration is pending", async () => {
    mocks.api.post.mockReturnValue(new Promise(() => {}));
    renderRegister();

    await fillAndSubmit("new@neondusk.gg", "Secret123", "Secret123");

    const submit = screen.getByRole("button", { name: "GERANDO CREDENCIAIS..." });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(submit.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
