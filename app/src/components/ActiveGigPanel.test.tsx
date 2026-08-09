import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ActiveGigPanel from "@/components/ActiveGigPanel";
import { useGigStore } from "@/stores/gig";

/** Escape-phase active gig (post-POST /escape). */
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

  it("renders without error when activeGig is null", () => {
    useGigStore.setState({ board: { gigs: [], activeGig: null } });
    render(<ActiveGigPanel />);
    // Component returns null when there is no active gig and no wrap-up
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

  it("renders Concluir gig button calling wrapUpGig (not escapeGig) when phase is escape", () => {
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
    fireEvent.click(screen.getByRole("button", { name: /concluir gig \(receber\)/i }));
    expect(wrapUpGig).toHaveBeenCalledWith("g-1");
    expect(escapeGig).not.toHaveBeenCalled();
  });

  it("renders heat warning when lastEscape.heatGenerated > 0", async () => {
    // Real flow: execute phase -> POST /escape resolves with heat -> activeGig
    // flips to escape phase and the escape outcome lands in local state.
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
    expect(await screen.findByText(/\+3 calor no distrito/i)).toBeInTheDocument();
  });

  it("keeps the escape phase from the escape response and does not refetch the board", async () => {
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

    // Phase came from the escape response — wrap-up action shown, stale fugir button gone.
    expect(await screen.findByRole("button", { name: /concluir gig \(receber\)/i })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /concluir gig \(receber\)/i })).toBeInTheDocument();
  });
});
