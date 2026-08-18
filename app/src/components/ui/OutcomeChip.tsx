import type { Outcome } from "./types";

export interface OutcomeChipProps {
  label: string;
  outcome: Outcome;
  roll?: number;
  chance?: number;
}

const OUTCOME_CLASSES = {
  success: "text-nd-green border-nd-green/40 bg-nd-green/10",
  failure: "text-nd-magenta border-nd-magenta/40 bg-nd-magenta/10",
  critical: "text-nd-gold border-nd-gold/40 bg-nd-gold/10",
} as const;

const OUTCOME_GLYPH = { success: "✓", failure: "✗", critical: "!" } as const;

/**
 * Roll/outcome chip for combat and gig resolution. Renders nothing while the
 * outcome is unknown (null). Critical always shows "CRÍTICO" regardless of
 * the caller-provided label. Color is never the only channel: glyph + text.
 */
export default function OutcomeChip({ label, outcome, roll, chance }: OutcomeChipProps) {
  if (outcome === null) return null;

  const text = outcome === "critical" ? "CRÍTICO" : label;
  const hasRoll = roll !== undefined && chance !== undefined;

  return (
    <span
      className={`inline-flex items-center gap-1 font-data text-[10px] uppercase tracking-widest border rounded-terminal px-1.5 py-0.5 ${OUTCOME_CLASSES[outcome]}`}
    >
      <span aria-hidden="true">{OUTCOME_GLYPH[outcome]}</span>
      {text}
      {hasRoll && (
        <span className="text-nd-text-secondary normal-case tracking-normal">
          (rolou {roll} vs {chance}%)
        </span>
      )}
    </span>
  );
}
