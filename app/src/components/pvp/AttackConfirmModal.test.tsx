import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AttackConfirmModal from "@/components/pvp/AttackConfirmModal";
import { useAuthStore } from "@/stores/auth";
import { useHudStore } from "@/stores/hud";
import { useStreetCredStore } from "@/stores/street-cred";
import type { Character, PvpTarget } from "@neon-dusk/shared";

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

const character: Character = {
  id: "c1",
  userId: "u1",
  name: "Ghost",
  origin: "a_paraiso",
  role: "bicho",
  body: 6,
  reflexes: 4,
  intelligence: 3,
  technical: 3,
  cool: 3,
  streetCred: 20,
  maxStreetCredAchieved: 20,
  ability: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const target: PvpTarget = {
  characterId: "c2",
  name: "Raven",
  streetCred: 12,
  power: 8,
  noobShield: true,
  weeklyAttacksReceived: 0,
  griefRisk: false,
};

function seedStores() {
  useAuthStore.setState({
    character,
    nilStatus: {
      current: 100,
      max: 100,
      nextTickSeconds: 0,
      regenerating: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  });
  useHudStore.setState({
    balance: 1000,
    escrow: 0,
    humanity: 50,
    statBonus: { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 },
  });
  useStreetCredStore.setState({
    info: {
      score: 20,
      title: "Perna",
      maxAchieved: 20,
      nextThreshold: { score: 25, title: "Pro" },
      scToNext: 5,
    },
  });
}

function renderModal(props: Partial<Parameters<typeof AttackConfirmModal>[0]> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(
    <AttackConfirmModal
      target={target}
      nilCost={20}
      open
      onClose={onClose}
      onConfirm={onConfirm}
      loading={false}
      error={null}
      {...props}
    />,
  );
  return { onClose, onConfirm };
}

/** Match an element by its full textContent (crosses the label/value span split). */
function byFullText(text: string) {
  return (_content: string, element: Element | null): boolean =>
    element !== null && element.textContent === text;
}

describe("AttackConfirmModal", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
    seedStores();
  });

  it("renders the two mirrored cards with the NIL cost and the loss risks", () => {
    renderModal();

    // VOCÊ side (from the stores): name, effective power, Moral, NIL, balance.
    expect(screen.getByText("VOCÊ")).toBeInTheDocument();
    expect(screen.getByText("Ghost")).toBeInTheDocument();
    expect(screen.getByText(byFullText("Poder: 10"))).toBeInTheDocument(); // 6 + 4 body/reflexes
    expect(screen.getByText(byFullText("M: 20"))).toBeInTheDocument();
    expect(screen.getByText(byFullText("NIL: 100"))).toBeInTheDocument();
    expect(screen.getByText(byFullText("Saldo: G$ 1.000"))).toBeInTheDocument();

    // Target side.
    expect(screen.getByText("Raven")).toBeInTheDocument();
    expect(screen.getByText(byFullText("Poder: 8"))).toBeInTheDocument();
    expect(screen.getByText(byFullText("M: 12"))).toBeInTheDocument();

    // Cost + risk (noobShield does NOT reduce the attacker's loot — it only
    // cuts the target's Moral loss; the badge on the card covers it).
    expect(screen.getByText("Custo: 20 NIL")).toBeInTheDocument();
    expect(
      screen.getByText(/Risco: -10% do saldo \(~G\$ 100\) · -5% Moral \(mín\. 1\)/),
    ).toBeInTheDocument();
  });

  it("shows the grief risk line when the target is already grief-risked", () => {
    renderModal({
      target: { ...target, noobShield: false, griefRisk: true, weeklyAttacksReceived: 4 },
    });

    expect(screen.getByText(/Risco: saque 1% \(grief\)/)).toBeInTheDocument();
  });

  it("shows the plain 10% loss risk for a regular target", () => {
    renderModal({
      target: { ...target, noobShield: false, griefRisk: false },
    });

    expect(screen.getByText(/Risco: -10% do saldo \(~G\$ 100\) · -5% Moral/)).toBeInTheDocument();
  });

  it("computes the player power from body + reflexes + statBonus", () => {
    useHudStore.setState({
      statBonus: { body: 2, reflexes: 1, intelligence: 0, technical: 0, cool: 0 },
    });

    renderModal();

    expect(screen.getByText(byFullText("Poder: 13"))).toBeInTheDocument(); // 6 + 4 + 2 + 1
  });

  it("confirms via CONFIRMAR ATAQUE and cancels via CANCELAR", async () => {
    const user = userEvent.setup();
    const { onClose, onConfirm } = renderModal();

    await user.click(screen.getByRole("button", { name: /CONFIRMAR ATAQUE/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /CANCELAR/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables the buttons while the attack is loading", () => {
    renderModal({ loading: true });

    expect(screen.getByRole("button", { name: /CONFIRMAR ATAQUE/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /CANCELAR/i })).toBeDisabled();
  });

  it("surfaces the API error message", () => {
    renderModal({ error: "Ação em cooldown. Aguarde." });

    expect(screen.getByText("Ação em cooldown. Aguarde.")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    renderModal({ open: false });

    expect(screen.queryByText("VOCÊ")).not.toBeInTheDocument();
    expect(screen.queryByText("Raven")).not.toBeInTheDocument();
  });
});
