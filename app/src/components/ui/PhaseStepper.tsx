import type { PhaseStep } from "./types";

export interface PhaseStepperProps {
  phases: PhaseStep[];
  /** Index of the current phase. Phases before it render as completed. */
  currentIndex?: number;
  /** Index of a phase that failed; renders "!" in magenta instead of the number. */
  errorIndex?: number;
  size?: "sm" | "md";
}

const SIZE = {
  sm: { dot: "w-5 h-5 text-[10px]", label: "text-[10px]" },
  md: { dot: "w-7 h-7 text-xs", label: "text-xs" },
} as const;

/**
 * Horizontal multi-phase progress indicator (gig loop, install flow...).
 * Current step gets aria-current="step"; errored step shows a "!" glyph.
 */
export default function PhaseStepper({
  phases,
  currentIndex = 0,
  errorIndex,
  size = "md",
}: PhaseStepperProps) {
  const s = SIZE[size];

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {phases.map((phase, i) => {
        const isError = errorIndex === i;
        const isDone = !isError && i < currentIndex;
        const isCurrent = !isError && i === currentIndex;

        return (
          <li key={phase.id} aria-current={isCurrent ? "step" : undefined} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className="h-px w-4 bg-nd-cyan/20" />}
            <span
              className={`inline-flex items-center justify-center rounded-terminal border font-data ${s.dot} ${
                isError
                  ? "border-nd-magenta text-nd-magenta bg-nd-magenta/10"
                  : isDone
                    ? "border-nd-purple bg-nd-purple text-nd-bg"
                    : isCurrent
                      ? "border-nd-cyan text-nd-cyan bg-nd-cyan/10"
                      : "border-nd-cyan/20 text-nd-text-secondary"
              }`}
            >
              {isError ? "!" : isDone ? "✓" : i + 1}
            </span>
            <span
              className={`font-data uppercase tracking-widest ${s.label} ${
                isCurrent ? "text-nd-text" : "text-nd-text-secondary"
              }`}
            >
              {phase.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
