import type { Outcome } from "./types";

export interface OutcomeChipProps {
  /** Outcome label — ignored for critical (always rendered as "CRÍTICO"). */
  label: string;
  outcome: Outcome;
  /**
   * Dice roll as a decimal in [0, 1). Negative values are the "no roll"
   * sentinel (the server returns -1 on idempotent retries) — the
   * "(rolou …)" detail is then omitted.
   */
  roll?: number;
  /** Success chance as a decimal in [0, 1] (0.55 = 55%). Rendered as percent. */
  chance?: number;
}

const OUTCOME_CLASSES = {
  success: "text-nd-green border-nd-green/40 bg-nd-green/10",
  failure: "text-nd-magenta border-nd-magenta/40 bg-nd-magenta/10",
  critical: "text-nd-gold border-nd-gold/40 bg-nd-gold/10",
} as const;

const OUTCOME_GLYPH = { success: "✓", failure: "✗", critical: "!" } as const;

/** Verdict suffix for success/failure — the glyph is never the only channel. */
const OUTCOME_VERDICT = { success: "BEM-SUCEDIDA", failure: "FALHOU", critical: null } as const;

/**
 * Roll/outcome chip for combat and trampo resolution. Renders nothing while the
 * outcome is unknown (null). Critical always shows "CRÍTICO" regardless of
 * the caller-provided label. Color is never the only channel: glyph + text.
 * `roll`/`chance` are decimals (0–1); a negative `roll` is the "no roll"
 * sentinel and hides the "(rolou …)" detail.
 */
export default function OutcomeChip({ label, outcome, roll, chance }: OutcomeChipProps) {
  if (outcome === null) return null;

  const verdict = OUTCOME_VERDICT[outcome];
  const text = verdict ? `${label} ${verdict}` : "CRÍTICO";
  const hasRoll = roll !== undefined && chance !== undefined && roll >= 0;

  return (
    <span
      className={`inline-flex items-center gap-1 font-data text-nd-micro uppercase tracking-widest border rounded-terminal px-1.5 py-0.5 ${OUTCOME_CLASSES[outcome]}`}
    >
      {`${OUTCOME_GLYPH[outcome]} ${text}`}
      {hasRoll && (
        <span className="text-nd-text-secondary normal-case tracking-normal">
          (rolou {roll.toFixed(2)} vs {Math.round(chance * 100)}%)
        </span>
      )}
    </span>
  );
}
