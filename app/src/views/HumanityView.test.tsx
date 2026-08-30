import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HumanityView from "@/views/HumanityView";
import { useHumanityStore } from "@/stores/humanity";
import { useConsumablesStore } from "@/stores/consumables";
import type { ConsumablesResponse, HumanityInfo } from "@neon-dusk/shared";

// Issue #28 — Humanidade view render tests. The view reads the Zustand
// humanity store (info/loading/error + fetch/undergoTherapy); tests drive the
// store state directly and mock the api client for the HUD refresh.

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

function info(overrides: Partial<HumanityInfo> = {}): HumanityInfo {
  return {
    humanity: 50,
    band: "instavel",
    flatlined: false,
    flatlinedAt: null,
    scrubber: { installed: false, pendingRegen: 0, nextRegenAt: null, cap: 50 },
    therapy: {
      lastCompletedAt: null,
      nextAvailableAt: null,
      cooldownRemainingMs: 0,
      clinic: {
        therapyType: "clinic",
        costMin: 5000,
        costMax: 20000,
        restoreMin: 10,
        restoreMax: 20,
      },
      attunement: {
        therapyType: "attunement",
        costMin: 2500,
        costMax: 10000,
        restoreMin: 5,
        restoreMax: 10,
      },
    },
    ...overrides,
  };
}

// Canonical consumables fixture (mirrors server/src/content/consumables.ts).
const sampleItems: ConsumablesResponse["items"] = [
  {
    id: "estabilizador",
    slug: "estabilizador",
    name: "Estabilizador",
    tier: 1,
    restoreAmount: 5,
    cooldownHours: 0,
    ownedQuantity: 1,
    nextAvailableAt: null,
  },
  {
    id: "freio",
    slug: "freio",
    name: "Freio",
    tier: 2,
    restoreAmount: 10,
    cooldownHours: 12,
    ownedQuantity: 2,
    nextAvailableAt: null,
  },
  {
    id: "choque",
    slug: "choque",
    name: "Choque",
    tier: 3,
    restoreAmount: 15,
    cooldownHours: 24,
    ownedQuantity: 0,
    nextAvailableAt: null,
  },
];

describe("HumanityView", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
    // The HUD refresh (fired after a successful session) reads 4 endpoints;
    // a resolved object keeps `numField`/`.balance` reads safe.
    mocks.api.get.mockResolvedValue({});
    useHumanityStore.setState({
      info: null,
      loading: false,
      error: null,
      fetch: async () => {},
      undergoTherapy: async () => ({
        therapyType: "clinic",
        cost: 5000,
        restored: 10,
        humanityBefore: 50,
        humanityAfter: 60,
        completedAt: "2026-08-30T12:00:00.000Z",
      }),
    });
    // Consumables panel (issue #48): seeded with items so the internal .map
    // never hits the mocked `{}` GET payload; fetch is a no-op (the view's
    // api mock does not serve /api/consumables).
    useConsumablesStore.setState({
      items: sampleItems,
      loading: false,
      error: null,
      useError: null,
      usingItemId: null,
      lastUse: null,
      fetch: async () => {},
    });
  });

  it("should render the view with the HumanityBar and the TherapyPanel", () => {
    useHumanityStore.setState({ info: info(), loading: false, error: null });

    render(<HumanityView />);

    expect(screen.getAllByText("HUMANIDADE").length).toBeGreaterThan(0);
    expect(screen.getByText("TERAPIA")).toBeInTheDocument();
    // The band label appears in the HumanityBar header AND in the MetricBar caption.
    expect(screen.getAllByText("Instável").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Sessão (Clínica)" })).toBeInTheDocument();
  });

  it("should show the therapy success message after a session", async () => {
    useHumanityStore.setState({ info: info(), loading: false, error: null });
    const user = userEvent.setup();

    render(<HumanityView />);

    await user.click(screen.getByRole("button", { name: "Sessão (Clínica)" }));

    expect(
      await screen.findByText(/Sessão concluída: -G\$ 5000, \+10 de humanidade/),
    ).toBeInTheDocument();
  });

  it("should surface the therapy error", async () => {
    // The view re-throws after setting the error (so callers can react); the
    // button's `void onTherapy(...)` leaves that rejection unhandled — swallow
    // it at the process level so Vitest does not fail the test.
    const onUnhandled = vi.fn();
    process.on("unhandledRejection", onUnhandled);
    useHumanityStore.setState({
      info: info(),
      loading: false,
      error: null,
      undergoTherapy: async () => {
        throw new Error("Você já fez terapia nas últimas 24h.");
      },
    });
    const user = userEvent.setup();

    render(<HumanityView />);

    await user.click(screen.getByRole("button", { name: "Sessão (Clínica)" }));

    expect(await screen.findByText("Você já fez terapia nas últimas 24h.")).toBeInTheDocument();
    process.off("unhandledRejection", onUnhandled);
  });

  it("should render the loading state while fetching", () => {
    useHumanityStore.setState({ info: null, loading: true, error: null });

    render(<HumanityView />);

    expect(screen.getAllByText(/loading/).length).toBeGreaterThan(0);
  });

  it("should use a consumable through the 2-step confirmation", async () => {
    useHumanityStore.setState({ info: info(), loading: false, error: null });
    mocks.api.post.mockResolvedValue({
      humanityBefore: 50,
      humanityAfter: 55,
      restored: 5,
      costEddies: 0,
      nextAvailableAt: null,
    });
    const user = userEvent.setup();

    render(<HumanityView />);

    await user.click(screen.getAllByRole("button", { name: "Usar" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirmar uso?" }));

    expect(
      await screen.findByText("Estabilizador: +5 de humanidade (50 → 55)."),
    ).toBeInTheDocument();
  });
});
