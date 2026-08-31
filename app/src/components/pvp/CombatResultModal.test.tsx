import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CombatResultModal from "@/components/pvp/CombatResultModal";
import type { PvpCombatResult } from "@neon-dusk/shared";

const victory: PvpCombatResult = {
  combatId: "pc1",
  won: true,
  attackerPower: 10,
  defenderPower: 8,
  lootAmount: 120,
  streetCredChange: 5,
  newStreetCred: 25,
  newBalance: 1120,
  grieferPenalty: false,
};

function renderModal(result: PvpCombatResult = victory, open = true) {
  const onClose = vi.fn();
  render(<CombatResultModal result={result} open={open} onClose={onClose} />);
  return { onClose };
}

describe("CombatResultModal", () => {
  it("renders the victory combat log", () => {
    renderModal();

    expect(screen.getByText("VITÓRIA")).toBeInTheDocument();
    expect(screen.getByText("Poder: 10 vs 8")).toBeInTheDocument();
    expect(screen.getByText("Saque: G$ 120")).toBeInTheDocument();
    expect(screen.getByText("Moral: +5 → 25")).toBeInTheDocument();
    expect(screen.getByText("Saldo: G$ 1120")).toBeInTheDocument();
  });

  it("renders the defeat log with a negative Moral delta", () => {
    renderModal({
      ...victory,
      won: false,
      streetCredChange: -1,
      newStreetCred: 29,
      newBalance: 900,
      lootAmount: 100,
    });

    expect(screen.getByText("DERROTA")).toBeInTheDocument();
    expect(screen.getByText("Moral: -1 → 29")).toBeInTheDocument();
    expect(screen.getByText("Perda: G$ 100")).toBeInTheDocument();
    expect(screen.getByText("Saldo: G$ 900")).toBeInTheDocument();
  });

  it("marks the loot as grief when the attacker was griefing", () => {
    renderModal({ ...victory, lootAmount: 4, grieferPenalty: true });

    expect(screen.getByText("Saque: G$ 4 (grief)")).toBeInTheDocument();
  });

  it("closes via the FECHAR button", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: /^FECHAR$/ }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when closed", () => {
    renderModal(victory, false);

    expect(screen.queryByText("VITÓRIA")).not.toBeInTheDocument();
  });
});
