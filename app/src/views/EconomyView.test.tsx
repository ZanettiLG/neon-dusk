import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import EconomyView from "@/views/EconomyView";
import type { EconomyBalanceResponse, TransactionListResponse } from "@neon-dusk/shared";

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

const balance: EconomyBalanceResponse = {
  balance: 1250,
  escrow: 250,
  lifetimeEarned: 5000,
  lifetimeSpent: 3750,
};

const transactions: TransactionListResponse = {
  transactions: [
    {
      id: "t1",
      characterId: "c1",
      type: "GIG_REWARD",
      amount: 150,
      balanceBefore: 1100,
      balanceAfter: 1250,
      source: "Gig: Extração",
      referenceType: "gig",
      referenceId: "g1",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  nextCursor: null,
};

describe("EconomyView", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
  });

  it("should show a loading state while the balance is being fetched", () => {
    mocks.api.get.mockImplementation(() => new Promise(() => {}));

    render(<EconomyView />);

    expect(screen.getAllByText("▌ loading...").length).toBeGreaterThan(0);
  });

  it("should render the balance card and transactions", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/economy/balance") return Promise.resolve(balance);
      if (url === "/api/economy/transactions") return Promise.resolve(transactions);
      return Promise.resolve({});
    });

    render(<EconomyView />);

    expect(await screen.findByText("1.250 eds")).toBeInTheDocument();
    expect(screen.getByText("250 eds")).toBeInTheDocument();
    expect(screen.getByText("1.000 eds")).toBeInTheDocument(); // balance - escrow
    expect(screen.getByText(/5.000 eds ganhos/)).toBeInTheDocument();
    expect(screen.getByText("GIG_REWARD")).toBeInTheDocument();
    expect(screen.getByText("+150 eds")).toBeInTheDocument();
    expect(mocks.api.get).toHaveBeenCalledWith("/api/economy/balance");
    expect(mocks.api.get).toHaveBeenCalledWith("/api/economy/transactions");
  });

  it("should show an error state when the balance fetch fails", async () => {
    mocks.api.get.mockRejectedValue(new Error("Falha ao carregar saldo"));

    render(<EconomyView />);

    // Balance and transactions both surface the same error message.
    expect((await screen.findAllByText("Falha ao carregar saldo")).length).toBeGreaterThan(0);
  });
});
