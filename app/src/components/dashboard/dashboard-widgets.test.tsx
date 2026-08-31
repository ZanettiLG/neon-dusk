import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import type { ActiveGig, Character, NilStatus, StreetCredInfo, User } from "@neon-dusk/shared";
import NilWidget from "@/components/dashboard/NilWidget";
import MoralWidget from "@/components/dashboard/MoralWidget";
import FundsWidget from "@/components/dashboard/FundsWidget";
import ActiveGigWidget from "@/components/dashboard/ActiveGigWidget";
import QuickActionsWidget from "@/components/dashboard/QuickActionsWidget";
import { useAuthStore } from "@/stores/auth";
import { useStreetCredStore } from "@/stores/street-cred";
import { useHudStore } from "@/stores/hud";
import { useGigStore } from "@/stores/gig";

// Issue #56 — dashboard widgets: baseline "renders without error" coverage for
// every new widget (each one renders conditionally inside the dashboard grid).

const mocks = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    code: string;
    details: unknown;
    constructor(status: number, code: string, message: string, details?: unknown) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }
  return {
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    ApiError: MockApiError,
  };
});

vi.mock("@/api/client", () => ({
  api: mocks.api,
  ApiError: mocks.ApiError,
}));

const user: User = {
  id: "u1",
  email: "fixer@neondusk.gg",
  role: "player",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const character: Character = {
  id: "c1",
  userId: "u1",
  name: "Ghost",
  origin: "a_paraiso",
  role: "bicho",
  body: 3,
  reflexes: 3,
  intelligence: 3,
  technical: 3,
  cool: 3,
  streetCred: 0,
  maxStreetCredAchieved: 0,
  ability: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const nilStatus: NilStatus = {
  current: 80,
  max: 100,
  nextTickSeconds: 300,
  regenerating: true,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const streetCredInfo: StreetCredInfo = {
  score: 40,
  title: "Pro",
  maxAchieved: 40,
  nextThreshold: { score: 50, title: "Corredor" },
  scToNext: 10,
};

const activeGig: ActiveGig = {
  id: "ag1",
  gigId: "g1",
  gigName: "Entrega no Fluxo",
  gigType: "delivery",
  gigTier: "t2",
  phase: "legwork",
  status: "active",
  acceptedAt: "2026-01-01T00:00:00.000Z",
  legworkStartedAt: null,
  legworkCompleted: false,
  legworkMinutes: 10,
  executeOutcome: null,
  escapeOutcome: null,
  actualPayout: null,
  escapeDifficulty: 0.5,
};

function renderWidget(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("dashboard widgets", () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState());
    useStreetCredStore.setState(useStreetCredStore.getInitialState());
    useHudStore.setState(useHudStore.getInitialState());
    useGigStore.setState(useGigStore.getInitialState());
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
  });

  describe("NilWidget", () => {
    it("renders the NIL bar, countdown and Pingado action", async () => {
      mocks.api.get.mockResolvedValue(nilStatus);
      useAuthStore.setState({ user, character, nilStatus, nilLoading: false, nilError: null });
      renderWidget(<NilWidget />);

      expect(await screen.findByRole("meter", { name: "NIL" })).toHaveAttribute(
        "aria-valuenow",
        "80",
      );
      expect(screen.getByText("NIL // CARGA NEURAL")).toBeInTheDocument();
      expect(screen.getByText(/Próximo \+1 em/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "PINGADO" })).toBeInTheDocument();
    });

    it("starts the Pingado cooldown from the NIL_STIM_COOLDOWN error details", async () => {
      mocks.api.get.mockResolvedValue(nilStatus);
      mocks.api.post.mockRejectedValue(
        new mocks.ApiError(400, "NIL_STIM_COOLDOWN", "Pingado em cooldown. Aguarde.", {
          retryAfterSeconds: 3600,
        }),
      );
      useAuthStore.setState({ user, character, nilStatus, nilLoading: false, nilError: null });
      renderWidget(<NilWidget />);

      const pingado = await screen.findByRole("button", { name: "PINGADO" });
      pingado.click();

      expect(await screen.findByRole("button", { name: /Pingado em/ })).toBeDisabled();
    });
  });

  describe("MoralWidget", () => {
    it("renders the live readout with title badge and next threshold", () => {
      useAuthStore.setState({ user, character });
      useStreetCredStore.setState({ info: streetCredInfo, loading: false, error: null });
      renderWidget(<MoralWidget />);

      expect(screen.getByText("MORAL")).toBeInTheDocument();
      expect(screen.getByText("Pro")).toBeInTheDocument();
      expect(screen.getByText("Próximo: Corredor (+10)")).toBeInTheDocument();
    });

    it("falls back to the character snapshot when the live readout fails", async () => {
      mocks.api.get.mockRejectedValue(new Error("api down"));
      useAuthStore.setState({ user, character });
      useStreetCredStore.setState({ info: null, loading: false, error: "api down" });
      renderWidget(<MoralWidget />);

      expect(await screen.findByText(/Dados ao vivo indisponíveis/)).toBeInTheDocument();
    });
  });

  describe("FundsWidget", () => {
    it("renders balance and escrow from the HUD store", () => {
      useHudStore.setState({ balance: 1234, escrow: 200, balanceError: null });
      renderWidget(<FundsWidget />);

      expect(screen.getByText("G$ 1.234")).toBeInTheDocument();
      expect(screen.getByText(/empenhados em/)).toBeInTheDocument();
    });

    it("renders the error state with retry when the wallet fetch fails", () => {
      useHudStore.setState({ balance: null, escrow: null, balanceError: "wallet down" });
      renderWidget(<FundsWidget />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    });
  });

  describe("ActiveGigWidget", () => {
    it("renders the active trampo with phase and continue link", () => {
      useGigStore.setState({ activeGig, activeGigLoading: false, activeGigError: null });
      renderWidget(<ActiveGigWidget />);

      expect(screen.getByText("TRAMPO ATIVO")).toBeInTheDocument();
      expect(screen.getByText("Entrega no Fluxo")).toBeInTheDocument();
      expect(screen.getByText("Fase:")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute("href", "/gigs");
    });

    it("renders the empty state with a board CTA when no trampo is active", async () => {
      useGigStore.setState({ activeGig: null, activeGigLoading: false, activeGigError: null });
      renderWidget(<ActiveGigWidget />);

      expect(await screen.findByText("Nenhum trampo ativo")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Ver quadro" })).toHaveAttribute("href", "/gigs");
    });
  });

  describe("QuickActionsWidget", () => {
    it("renders the five shortcuts", () => {
      renderWidget(<QuickActionsWidget />);

      expect(screen.getByText("AÇÕES RÁPIDAS")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Trampos" })).toHaveAttribute("href", "/gigs");
      expect(screen.getByRole("link", { name: "Vendedores" })).toHaveAttribute("href", "/vendors");
    });
  });
});
