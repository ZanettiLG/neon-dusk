import { describe, it, expect } from "vitest";
import { formatEventMessage, EVENT_TYPE_LABELS } from "@/lib/events";

// ND-139 — event feed helpers: PT-BR message sentences (payload-aware with
// label fallback) and the severity → Tailwind class map.

describe("formatEventMessage", () => {
  it("should render GIG_COMPLETED with gigName and payout", () => {
    expect(
      formatEventMessage("GIG_COMPLETED", { gigName: "Corre da Farmácia", payout: 550 }),
    ).toBe('Trampo "Corre da Farmácia" concluído — +G$ 550');
  });

  it("should render GIG_FAILED with gigName", () => {
    expect(formatEventMessage("GIG_FAILED", { gigName: "Encomenda Extraviada" })).toBe(
      'Trampo "Encomenda Extraviada" falhou',
    );
  });

  it("should render EDDIES_EARNED / EDDIES_SPENT with amount", () => {
    expect(formatEventMessage("EDDIES_EARNED", { amount: 120 })).toBe("+G$ 120 ganhos");
    expect(formatEventMessage("EDDIES_SPENT", { amount: 30 })).toBe("-G$ 30 gastos");
  });

  it("should render NIL_SPENT with amount", () => {
    expect(formatEventMessage("NIL_SPENT", { amount: 20 })).toBe("-20 NIL gasto");
  });

  it("should render PVP_ATTACK as attacker-perspective result from the won flag", () => {
    expect(formatEventMessage("PVP_ATTACK", { targetId: "x", won: true, lootAmount: 50 })).toBe(
      "Vitória em PvP",
    );
    expect(formatEventMessage("PVP_ATTACK", { targetId: "x", won: false, lootAmount: 0 })).toBe(
      "Derrota em PvP",
    );
  });

  it("should render PVP_DEFEAT via the type label (not yet emitted server-side)", () => {
    expect(formatEventMessage("PVP_DEFEAT", {})).toBe(EVENT_TYPE_LABELS.PVP_DEFEAT);
  });

  it("should fall back to the type label when payload keys are missing", () => {
    expect(formatEventMessage("GIG_COMPLETED", {})).toBe(EVENT_TYPE_LABELS.GIG_COMPLETED);
    expect(formatEventMessage("EDDIES_EARNED", {})).toBe(EVENT_TYPE_LABELS.EDDIES_EARNED);
    expect(formatEventMessage("NIL_SPENT", {})).toBe(EVENT_TYPE_LABELS.NIL_SPENT);
    expect(formatEventMessage("CHARACTER_CREATED", {})).toBe(
      EVENT_TYPE_LABELS.CHARACTER_CREATED,
    );
    expect(formatEventMessage("NIL_RESTORED", { gigName: "irrelevant" })).toBe(
      EVENT_TYPE_LABELS.NIL_RESTORED,
    );
  });

  it("should fall back to the type label when payload values are the wrong type", () => {
    // num()/str() reject non-number/empty values — a string amount is not used.
    expect(formatEventMessage("EDDIES_EARNED", { amount: "100" })).toBe(
      EVENT_TYPE_LABELS.EDDIES_EARNED,
    );
    expect(formatEventMessage("GIG_FAILED", { gigName: "" })).toBe(EVENT_TYPE_LABELS.GIG_FAILED);
  });
});
