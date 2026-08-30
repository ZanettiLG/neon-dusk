import type { GameEventType } from "@neon-dusk/shared";

// Event feed helpers for the corredor dashboard (ND-139): PT-BR labels and
// per-type message sentences. Severity styling lives in ui/EventLog (#134).

/** Short PT-BR label for every game event type. */
export const EVENT_TYPE_LABELS: Record<GameEventType, string> = {
  CHARACTER_CREATED: "Personagem criado",
  GIG_STARTED: "Trampo iniciado",
  GIG_COMPLETED: "Trampo concluído",
  GIG_FAILED: "Trampo falhou",
  PVP_ATTACK: "Ataque PvP",
  PVP_DEFEAT: "Derrota em PvP",
  EDDIES_EARNED: "G$ ganhos",
  EDDIES_SPENT: "G$ gastos",
  NIL_SPENT: "NIL gasto",
  NIL_RESTORED: "NIL restaurado",
  VENDOR_PURCHASE: "Compra em vendedor",
  ABILITY_ACTIVATED: "Habilidade ativada",
  ABILITY_CONSUMED: "Habilidade consumida",
  // Issue #28 — cromo incompleto (OS, terapia, itens anti-insanidade).
  OS_ACTIVATED: "SO ativado",
  THERAPY_COMPLETED: "Terapia concluída",
  HUMANITY_RESTORED: "Humanidade restaurada",
};

/** Read a numeric payload key, returning null when absent/not a number. */
function num(payload: Record<string, unknown>, key: string): number | null {
  const v = payload[key];
  return typeof v === "number" ? v : null;
}

/** Read a string payload key, returning null when absent/not a string. */
function str(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Human PT-BR sentence for an event, reading known payload keys where present.
 * Falls back to the type label when the payload keys are absent.
 */
export function formatEventMessage(
  eventType: GameEventType,
  payload: Record<string, unknown>,
): string {
  switch (eventType) {
    case "GIG_COMPLETED": {
      const name = str(payload, "gigName");
      const payout = num(payload, "payout");
      if (name && payout !== null) return `Trampo "${name}" concluído — +G$ ${payout}`;
      return EVENT_TYPE_LABELS.GIG_COMPLETED;
    }
    case "GIG_FAILED": {
      const name = str(payload, "gigName");
      return name ? `Trampo "${name}" falhou` : EVENT_TYPE_LABELS.GIG_FAILED;
    }
    // Server emits PVP_ATTACK with { targetId, won, lootAmount } (attacker
    // perspective). PVP_DEFEAT is not yet emitted server-side — forward-looking.
    case "PVP_ATTACK":
      return payload.won === true ? "Vitória em PvP" : "Derrota em PvP";
    case "PVP_DEFEAT":
      return EVENT_TYPE_LABELS.PVP_DEFEAT;
    case "EDDIES_EARNED":
    case "EDDIES_SPENT": {
      const amount = num(payload, "amount");
      if (amount !== null) {
        return eventType === "EDDIES_EARNED" ? `+G$ ${amount} ganhos` : `-G$ ${amount} gastos`;
      }
      return eventType === "EDDIES_EARNED"
        ? EVENT_TYPE_LABELS.EDDIES_EARNED
        : EVENT_TYPE_LABELS.EDDIES_SPENT;
    }
    case "NIL_SPENT": {
      const amount = num(payload, "amount");
      return amount !== null ? `-${amount} NIL gasto` : EVENT_TYPE_LABELS.NIL_SPENT;
    }
    default:
      return EVENT_TYPE_LABELS[eventType];
  }
}
