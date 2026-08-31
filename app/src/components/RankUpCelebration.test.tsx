import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { create } from "zustand";
import RankUpCelebration from "@/components/RankUpCelebration";

const storeMocks = vi.hoisted(() => ({
  rankUp: null as { title: string; score: number; threshold: number } | null,
  clearRankUp: vi.fn(),
}));

vi.mock("@/stores/street-cred", () => ({
  useStreetCredStore: create(() => ({ ...storeMocks })),
}));

const { useStreetCredStore } = await import("@/stores/street-cred");

describe("RankUpCelebration", () => {
  beforeEach(() => {
    useStreetCredStore.setState({ rankUp: null });
    vi.clearAllMocks();
  });

  it("renders nothing while no rank-up event is pending (baseline)", () => {
    render(<RankUpCelebration />);
    expect(screen.queryByText("RANK-UP // MORAL")).not.toBeInTheDocument();
  });

  it("shows the new title, threshold line and Carcará quote when a rank-up fires", () => {
    useStreetCredStore.setState({
      rankUp: { title: "Pro", score: 30, threshold: 25 },
    });
    render(<RankUpCelebration />);
    expect(screen.getByText("RANK-UP // MORAL")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Moral 30 — degrau de 25")).toBeInTheDocument();
    expect(screen.getByText(/Bem-vindo ao jogo de verdade/)).toBeInTheDocument();
  });

  it("closes via the modal close button (dismiss by user, no timer)", async () => {
    useStreetCredStore.setState({
      rankUp: { title: "Lenda", score: 100, threshold: 100 },
    });
    render(<RankUpCelebration />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Fechar" }));
    expect(storeMocks.clearRankUp).toHaveBeenCalledTimes(1);
  });
});
