import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ActiveGigPanel from "@/components/ActiveGigPanel";
import { useGigStore } from "@/stores/gig";

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
    useGigStore.setState({ board: { gigs: [], activeGig: null, dailyCount: 0 } });
    render(<ActiveGigPanel />);
    // Component returns null when there is no active gig and no wrap-up
    expect(document.body).toBeTruthy(); // no crash
  });

  it("renders meet phase with legwork and execute buttons", () => {
    useGigStore.setState({
      board: {
        gigs: [],
        dailyCount: 0,
        activeGig: {
          id: "ag-1",
          gigId: "g-1",
          characterId: "c-1",
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
        dailyCount: 0,
        activeGig: {
          id: "ag-1",
          gigId: "g-1",
          characterId: "c-1",
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
        dailyCount: 0,
        activeGig: {
          id: "ag-2",
          gigId: "g-2",
          characterId: "c-1",
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
});
