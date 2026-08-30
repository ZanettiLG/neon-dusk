import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import OsView from "@/views/OsView";
import { useOsStore } from "@/stores/os";

// Issue #28 — OS view render tests. Thin wrapper around OsPanel; the store is
// driven directly (no network).

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

describe("OsView", () => {
  beforeEach(() => {
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

  it("should render the view heading and the OS panel", () => {
    render(<OsView />);

    expect(screen.getByText("SISTEMA OPERACIONAL")).toBeInTheDocument();
    expect(screen.getByText(/Nenhum SO instalado/)).toBeInTheDocument();
  });

  it("should render the installed OS card when the store has a status", () => {
    useOsStore.setState({
      status: {
        installed: true,
        os: { slug: "os-surge", name: "SO Surto" },
        ability: {
          isActive: false,
          activeUntil: null,
          usesRemaining: 5,
          usedToday: 0,
          maxUsesPerDay: 5,
          durationSeconds: 30,
          inert: false,
          resetsAt: "2026-08-31T00:00:00.000Z",
        },
      },
      loading: false,
      error: null,
    });

    render(<OsView />);

    expect(screen.getByText("SO Surto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativar" })).toBeInTheDocument();
  });
});