import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { create } from "zustand";
import BalcaoCard, { carcaraQuoteFor } from "@/components/BalcaoCard";

vi.mock("@/stores/street-cred", () => ({
  useStreetCredStore: create(() => ({
    info: null,
  })),
}));

const { useStreetCredStore } = await import("@/stores/street-cred");

describe("carcaraQuoteFor", () => {
  it("returns the quote for the highest tier at or below the score", () => {
    expect(carcaraQuoteFor(100)).toContain("Lenda bebe de graça");
    expect(carcaraQuoteFor(90)).toContain("Cê quer ser lembrado");
    expect(carcaraQuoteFor(50)).toContain("Esse trampo? Cê não volta");
    expect(carcaraQuoteFor(25)).toContain("Bem-vindo ao jogo de verdade");
    expect(carcaraQuoteFor(10)).toContain("Me lembra do que eu fiz");
  });

  it("falls back to the entry line below the first quote tier", () => {
    expect(carcaraQuoteFor(4)).toContain("Me lembra do que eu fiz");
  });
});

describe("BalcaoCard", () => {
  beforeEach(() => {
    useStreetCredStore.setState({ info: null });
  });

  it("renders the card header, quote and rule without error", () => {
    render(<BalcaoCard />);
    expect(screen.getByText("CARCARÁ // A LENDA")).toBeInTheDocument();
    expect(screen.getByText("A Regra")).toBeInTheDocument();
    expect(screen.getByText(/Dentro da Saideira não se saca arma/)).toBeInTheDocument();
  });

  it("picks the quote from the live Moral readout", () => {
    useStreetCredStore.setState({
      info: { score: 55, title: "Corredor", maxAchieved: 55, nextThreshold: null, scToNext: null },
    });
    render(<BalcaoCard />);
    expect(screen.getByText(/Esse trampo\? Cê não volta/)).toBeInTheDocument();
  });
});
