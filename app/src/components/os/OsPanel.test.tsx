import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OsPanel from "@/components/os/OsPanel";
import { useOsStore } from "@/stores/os";
import type { OsStatus } from "@neon-dusk/shared";

// Issue #28 — OS panel render tests. The panel reads the Zustand os store
// (status/loading/error + fetch/activate); tests drive the store state
// directly (no network) and mock the api client for the HUD refresh.

const mocks = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/api/client", () => ({
  api: mocks.api,
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

function furyStatus(overrides: Partial<OsStatus> = {}): OsStatus {
  return {
    installed: true,
    os: { slug: "os-fury", name: "SO Fúria" },
    ability: {
      isActive: false,
      activeUntil: null,
      usesRemaining: 3,
      usedToday: 0,
      maxUsesPerDay: 3,
      durationSeconds: 60,
      inert: false,
      resetsAt: "2026-08-31T00:00:00.000Z",
    },
    ...overrides,
  };
}

const GAZUA_STATUS: OsStatus = {
  installed: true,
  os: { slug: "os-gazuah", name: "SO Gazuá" },
  ability: {
    isActive: false,
    activeUntil: null,
    usesRemaining: 0,
    usedToday: 0,
    maxUsesPerDay: 0,
    durationSeconds: 0,
    inert: true,
    resetsAt: "2026-08-31T00:00:00.000Z",
  },
};

describe("OsPanel", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
    // The HUD refresh (fired after a successful activation) reads 4 endpoints;
    // a resolved object keeps `numField`/`.balance` reads safe.
    mocks.api.get.mockResolvedValue({});
    useOsStore.setState({
      status: null,
      loading: false,
      error: null,
      fetch: async () => {},
      activate: async () => ({
        success: true,
        activeUntil: "2026-08-30T12:01:00.000Z",
        usesRemaining: 2,
        message: "SO Fúria ativado.",
      }),
    });
  });

  it("should render the loading state while fetching", () => {
    useOsStore.setState({ status: null, loading: true, error: null });

    render(<OsPanel />);

    expect(screen.getByText(/loading/)).toBeInTheDocument();
  });

  it("should render the empty state when no OS is installed", () => {
    useOsStore.setState({
      status: { installed: false, os: null, ability: null },
      loading: false,
      error: null,
    });

    render(<OsPanel />);

    expect(screen.getByText(/Nenhum SO instalado/)).toBeInTheDocument();
  });

  it("should render the OS card with the daily charge readout", () => {
    useOsStore.setState({ status: furyStatus(), loading: false, error: null });

    render(<OsPanel />);

    expect(screen.getByText("SO Fúria")).toBeInTheDocument();
    expect(screen.getByText(/Ativações hoje:/)).toBeInTheDocument();
    expect(screen.getByText("0/3")).toBeInTheDocument();
    expect(screen.getByText("60s")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativar" })).toBeInTheDocument();
  });

  it("should render the inert state for Gazuá (no activation button)", () => {
    useOsStore.setState({ status: GAZUA_STATUS, loading: false, error: null });

    render(<OsPanel />);

    expect(screen.getByText("SO Gazuá")).toBeInTheDocument();
    expect(screen.getByText(/SO inerte nesta rodada/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ativar" })).not.toBeInTheDocument();
  });

  it("should disable the button when the effect is active", () => {
    useOsStore.setState({
      status: furyStatus({
        ability: {
          isActive: true,
          activeUntil: new Date(Date.now() + 30_000).toISOString(),
          usesRemaining: 2,
          usedToday: 1,
          maxUsesPerDay: 3,
          durationSeconds: 60,
          inert: false,
          resetsAt: "2026-08-31T00:00:00.000Z",
        },
      }),
      loading: false,
      error: null,
    });

    render(<OsPanel />);

    expect(screen.getByRole("button", { name: "Efeito ativo" })).toBeDisabled();
    expect(screen.getByText(/Efeito ativo — encerra em/)).toBeInTheDocument();
  });

  it("should disable the button when the daily charges are exhausted", () => {
    useOsStore.setState({
      status: furyStatus({
        ability: {
          isActive: false,
          activeUntil: null,
          usesRemaining: 0,
          usedToday: 3,
          maxUsesPerDay: 3,
          durationSeconds: 60,
          inert: false,
          resetsAt: "2026-08-31T00:00:00.000Z",
        },
      }),
      loading: false,
      error: null,
    });

    render(<OsPanel />);

    expect(screen.getByRole("button", { name: "Sem ativações hoje" })).toBeDisabled();
  });

  it("should activate the OS on click and surface the success message", async () => {
    const activate = vi.fn().mockResolvedValue({
      success: true,
      activeUntil: "2026-08-30T12:01:00.000Z",
      usesRemaining: 2,
      message: "SO Fúria ativado.",
    });
    useOsStore.setState({ status: furyStatus(), loading: false, error: null, activate });
    const user = userEvent.setup();

    render(<OsPanel />);

    await user.click(screen.getByRole("button", { name: "Ativar" }));

    expect(activate).toHaveBeenCalled();
    expect(await screen.findByText("SO Fúria ativado.")).toBeInTheDocument();
  });

  it("should surface the activation error", async () => {
    const activate = vi.fn().mockRejectedValue(new Error("Sem ativações restantes hoje."));
    useOsStore.setState({ status: furyStatus(), loading: false, error: null, activate });
    const user = userEvent.setup();

    render(<OsPanel />);

    await user.click(screen.getByRole("button", { name: "Ativar" }));

    expect(await screen.findByText("Sem ativações restantes hoje.")).toBeInTheDocument();
  });

  it("should render the error state with a retry button", () => {
    useOsStore.setState({ status: null, loading: false, error: "Falha ao carregar SO" });

    render(<OsPanel />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Falha ao carregar SO")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});