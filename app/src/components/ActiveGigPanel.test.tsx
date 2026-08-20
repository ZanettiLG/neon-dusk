import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { GigEscapeResponse } from "@neon-dusk/shared";
import ActiveGigPanel from "@/components/ActiveGigPanel";
import { useGigStore } from "@/stores/gig";

/** Escape-phase active trampo (post-POST /escape). */
function escapePhaseGig(overrides: Record<string, unknown> = {}) {
  return {
          id: "ag-1",
          gigId: "g-1",
          gigName: "Corre da Farmácia",
    gigType: "delivery",
    gigTier: "t1",
    phase: "escape",
    status: "active",
    acceptedAt: "2026-01-01T00:00:00Z",
    legworkStartedAt: null,
    legworkCompleted: false,
    legworkMinutes: 5,
    executeOutcome: "success",
    escapeOutcome: "success",
    actualPayout: 550,
    escapeDifficulty: 0.5,
    ...overrides,
  };
}

const mocks = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const originalMatchMedia = window.matchMedia;

/**
 * jsdom has no matchMedia — stub it so the RollTheater stage delays collapse
 * to ~0ms (the prefers-reduced-motion path). Restored in afterEach.
 */
function stubReducedMotion() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

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

describe("ActiveGigPanel", () => {
  beforeEach(() => {
    useGigStore.setState(useGigStore.getInitialState());
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia as typeof window.matchMedia;
  });

  it("renders without error when activeGig is null", () => {
    useGigStore.setState({ board: { gigs: [], activeGig: null } });
    render(<ActiveGigPanel />);
    // Component returns null when there is no active trampo and no wrap-up
    expect(document.body).toBeTruthy(); // no crash
  });

  it("renders meet phase with legwork and execute buttons", () => {
    useGigStore.setState({
      board: {
        gigs: [],
        activeGig: {
          id: "ag-1",
          gigId: "g-1",
          gigName: "Corre da Farmácia",
          gigType: "delivery",
          gigTier: "t1",
          phase: "meet",
          status: "active",
          acceptedAt: "2026-01-01T00:00:00Z",
          legworkStartedAt: null,
          legworkCompleted: false,
          legworkMinutes: 5,
          executeOutcome: null,
          escapeOutcome: null,
          actualPayout: null,
          escapeDifficulty: 0.5,
        },
      },
    });
    render(<ActiveGigPanel />);
    expect(screen.getByText("Corre da Farmácia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /legwork/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /executar direto/i })).toBeInTheDocument();
  });

  it("renders execute phase with outcome chip and escape button", () => {
    useGigStore.setState({
      board: {
        gigs: [],
        activeGig: {
          id: "ag-1",
          gigId: "g-1",
          gigName: "Corre da Farmácia",
          gigType: "delivery",
          gigTier: "t1",
          phase: "execute",
          status: "active",
          acceptedAt: "2026-01-01T00:00:00Z",
          legworkStartedAt: null,
          legworkCompleted: false,
          legworkMinutes: 5,
          executeOutcome: "success",
          escapeOutcome: null,
          actualPayout: 550,
          escapeDifficulty: 0.5,
        },
      },
    });
    render(<ActiveGigPanel />);
    // Phase indicator should highlight "Executar" (index 2)
    expect(screen.getByText("Executar")).toBeInTheDocument();
    // OutcomeChip shows the execution result (within the execute phase block)
    expect(screen.getByText(/bem-sucedida/i)).toBeInTheDocument();
    // Escape button must be present
    expect(screen.getByRole("button", { name: /fugir/i })).toBeInTheDocument();
    // Success message in Portuguese
    expect(screen.getByText(/serviço limpo/i)).toBeInTheDocument();
  });

  it("renders execute phase failure message", () => {
    useGigStore.setState({
      board: {
        gigs: [],
        activeGig: {
          id: "ag-2",
          gigId: "g-2",
          gigName: "Encomenda Extraviada",
          gigType: "sabotage",
          gigTier: "t2",
          phase: "execute",
          status: "active",
          acceptedAt: "2026-01-01T00:00:00Z",
          legworkStartedAt: null,
          legworkCompleted: false,
          legworkMinutes: 5,
          executeOutcome: "failure",
          escapeOutcome: null,
          actualPayout: 0,
          escapeDifficulty: 0.5,
        },
      },
    });
    render(<ActiveGigPanel />);
    // Failure message
    expect(screen.getByText(/deu ruim/i)).toBeInTheDocument();
    // Escape button still present
    expect(screen.getByRole("button", { name: /fugir/i })).toBeInTheDocument();
    // BEM-SUCEDIDA chip from OutcomeChip — not present on failure
    expect(screen.getByText(/✗/)).toBeInTheDocument();
  });

  it("renders escape outcome chip when phase is escape", () => {
    useGigStore.setState({
      board: {
        gigs: [],
        activeGig: escapePhaseGig({ escapeOutcome: "success" }),
      },
    });
    render(<ActiveGigPanel />);
    // Fuga outcome chip shows the escape result
    expect(screen.getByText(/✓ FUGA BEM-SUCEDIDA/i)).toBeInTheDocument();
    // Execute outcome chip is also shown (post-execute context)
    expect(screen.getByText(/✓ EXECUÇÃO BEM-SUCEDIDA/i)).toBeInTheDocument();
  });

  it("renders escape failure outcome chip when phase is escape with failure", () => {
    useGigStore.setState({
      board: {
        gigs: [],
        activeGig: escapePhaseGig({ escapeOutcome: "failure" }),
      },
    });
    render(<ActiveGigPanel />);
    // Fuga outcome chip shows failure
    expect(screen.getByText(/FUGA.*FALHOU/i)).toBeInTheDocument();
    expect(screen.getByText(/✗/)).toBeInTheDocument();
  });

  it("renders Concluir trampo button calling wrapUpGig (not escapeGig) when phase is escape", () => {
    const wrapUpGig = vi.fn().mockResolvedValue({});
    const escapeGig = vi.fn();
    useGigStore.setState({
      wrapUpGig,
      escapeGig,
      board: {
        gigs: [],
        activeGig: escapePhaseGig(),
      },
    });
    render(<ActiveGigPanel />);
    fireEvent.click(screen.getByRole("button", { name: /concluir trampo \(receber\)/i }));
    expect(wrapUpGig).toHaveBeenCalledWith("g-1");
    expect(escapeGig).not.toHaveBeenCalled();
  });

  it("should call escapeGig exactly once when Fugir / Extração is double-clicked synchronously", async () => {
    // Escape action that stays pending until the test resolves it — keeps the
    // actionInFlight ref armed across both synchronous clicks (the mocked
    // escapeGig never touches actionLoading, mirroring the store-action mocks
    // used elsewhere in this suite).
    let resolveEscape!: (value: GigEscapeResponse) => void;
    const escapeGig = vi.fn<(id: string) => Promise<GigEscapeResponse>>((_id: string) => {
      return new Promise<GigEscapeResponse>((resolve) => {
        resolveEscape = resolve;
      });
    });

    useGigStore.setState({
      escapeGig,
      board: {
        gigs: [],
        activeGig: escapePhaseGig({ phase: "execute", escapeOutcome: null }),
      },
    });
    render(<ActiveGigPanel />);

    const button = screen.getByRole("button", { name: /fugir/i });
    fireEvent.click(button);
    fireEvent.click(button);

    // The actionInFlight guard must swallow the synchronous re-entry: even
    // with a fast user double-click, exactly one escape request is fired.
    expect(escapeGig).toHaveBeenCalledTimes(1);
    expect(escapeGig).toHaveBeenCalledWith("g-1");

    // Settle the pending escape so the component finishes cleanly.
    resolveEscape({
      activeGig: escapePhaseGig({ phase: "execute", escapeOutcome: null }),
      outcome: { success: true, roll: 0.9, successChance: 0.8 },
      heatGenerated: 1,
    });
    await act(async () => {});
  });

  it("renders heat warning when lastEscape.heatGenerated > 0", async () => {
    // Real flow: execute phase -> POST /escape resolves with heat -> activeGig
    // flips to escape phase and the escape outcome lands in local state.
    stubReducedMotion();
    useGigStore.setState({
      board: {
        gigs: [],
        activeGig: escapePhaseGig({ phase: "execute", escapeOutcome: null }),
      },
    });
    mocks.api.post.mockResolvedValueOnce({
      activeGig: escapePhaseGig(),
      outcome: { success: true, roll: 0.9, successChance: 0.8 },
      heatGenerated: 3,
    });
    render(<ActiveGigPanel />);
    fireEvent.click(screen.getByRole("button", { name: /fugir/i }));
    // The RollTheater opens over the phase content; the heat warning only
    // appears in the phase content after the theater is dismissed.
    fireEvent.click(await screen.findByRole("button", { name: /continuar/i }));
    expect(await screen.findByText(/\+3 calor no distrito/i)).toBeInTheDocument();
  });

  it("keeps the escape phase from the escape response and does not refetch the board", async () => {
    stubReducedMotion();
    useGigStore.setState({
      board: {
        gigs: [],
        activeGig: escapePhaseGig({ phase: "execute", escapeOutcome: null }),
      },
    });
    // Retry-style response: server already committed — roll is the -1 sentinel.
    mocks.api.post.mockResolvedValueOnce({
      activeGig: escapePhaseGig(),
      outcome: { success: true, roll: -1, successChance: 0 },
      heatGenerated: 3,
    });
    render(<ActiveGigPanel />);
    fireEvent.click(screen.getByRole("button", { name: /fugir/i }));

    // The sentinel roll (-1) opens the theater in its copy stage — dismiss it
    // to reveal the escape phase content (wrap-up action, no stale fugir).
    fireEvent.click(await screen.findByRole("button", { name: /continuar/i }));

    // Phase came from the escape response — wrap-up action shown, stale fugir button gone.
    expect(await screen.findByRole("button", { name: /concluir trampo \(receber\)/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fugir/i })).not.toBeInTheDocument();
    // Sentinel roll (-1) must not render "(rolou -1 vs 0%)".
    expect(screen.queryByText(/rolou/i)).not.toBeInTheDocument();
    // No board refetch overwrote the phase.
    expect(mocks.api.get).not.toHaveBeenCalled();
  });

  it("does not render the Fugir / Extração button when phase is escape", () => {
    useGigStore.setState({
      board: {
        gigs: [],
        activeGig: escapePhaseGig(),
      },
    });
    render(<ActiveGigPanel />);
    // The escape phase shows the wrap-up action instead of a second escape roll
    expect(screen.queryByRole("button", { name: /fugir/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /concluir trampo \(receber\)/i })).toBeInTheDocument();
  });
});
