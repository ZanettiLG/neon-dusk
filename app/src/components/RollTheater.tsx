import { useEffect, useState } from "react";

/** Server-resolved roll outcome (issue #140). */
export interface RollTheaterOutcome {
  success: boolean;
  /** Raw roll 0–1. Values < 0 are the idempotent-retry sentinel (no roll happened). */
  roll: number;
  successChance: number;
}

interface RollTheaterProps {
  /** Diegetic stage label: "EXECUÇÃO" | "FUGA". */
  label: string;
  /** Already-resolved outcome — this component NEVER computes success. */
  outcome: RollTheaterOutcome;
  /** Diegetic flavor text (`gig-copy`). */
  copy: string;
  /** Fired when the user clicks "continuar" at the end of the sequence. */
  onComplete: () => void;
}

type Stage = "rolling" | "reveal" | "verdict" | "copy" | "done";

/** Sequential stage machine; `done` waits for user input. */
const NEXT: Record<Exclude<Stage, "done">, Stage> = {
  rolling: "reveal",
  reveal: "verdict",
  verdict: "copy",
  copy: "done",
};

/** Stage durations (ms): rolling ~1400, reveal 500, verdict 400, copy 400. */
const STAGE_MS: Record<Exclude<Stage, "done">, number> = {
  rolling: 1400,
  reveal: 500,
  verdict: 400,
  copy: 400,
};

/** All delays collapse to 0ms under prefers-reduced-motion (jsdom-safe guard). */
function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Presentational roll theater: plays the diegetic roll sequence for an outcome
 * the server already resolved. Invariant: success is NEVER recomputed here —
 * `outcome.success` comes verbatim from the POST /execute or /escape response.
 * Sequence: ROLLING → reveal (raw roll) → verdict (roll% vs chance%) → copy →
 * "continuar" (user-dismissed, never auto). The `roll < 0` sentinel skips the
 * numeric stages and shows only ✓/✗ {label} SUCESSO/FALHA + copy.
 */
export default function RollTheater({ label, outcome, copy, onComplete }: RollTheaterProps) {
  const isSentinel = outcome.roll < 0;
  const [stage, setStage] = useState<Stage>(isSentinel ? "copy" : "rolling");

  // Stage machine: each stage schedules the next; the cleanup clears the
  // pending timer on stage change/unmount (no setState after unmount).
  useEffect(() => {
    if (stage === "done") return;
    const timer = window.setTimeout(
      () => setStage(NEXT[stage]),
      reducedMotion() ? 0 : STAGE_MS[stage],
    );
    return () => window.clearTimeout(timer);
  }, [stage]);

  const ok = outcome.success;
  const rollPct = Math.round(outcome.roll * 100);
  const chancePct = Math.round(outcome.successChance * 100);
  const verdictColor = ok ? "text-nd-green" : "text-nd-magenta";
  // Verdict line: ✓/✗ + label (success is also carried by glyph + text + color,
  // never color alone). Numeric ROLL/CHANCE only in the verdict stage; the
  // sentinel never passes through it.
  const showVerdictLine =
    stage === "verdict" || (isSentinel && (stage === "copy" || stage === "done"));

  return (
    <div role="status" aria-live="polite" className="space-y-3">
      {stage === "rolling" && (
        <p className="font-data text-sm text-nd-cyan">
          <span className="inline-block animate-flicker" aria-hidden="true">
            ▌▌
          </span>{" "}
          ROLLING...
        </p>
      )}

      {stage === "reveal" && (
        <p className="font-data text-4xl text-nd-text animate-glitch">
          {outcome.roll.toFixed(2)}
        </p>
      )}

      {showVerdictLine && (
        <div className="space-y-1">
          <p className={`font-data text-sm ${verdictColor}`}>
            {ok ? "✓" : "✗"} {label.toUpperCase()} {ok ? "SUCESSO" : "FALHA"}
          </p>
          {stage === "verdict" && (
            <p className={`font-data text-sm ${verdictColor}`}>
              ROLL {outcome.roll.toFixed(2)} ({rollPct}%) vs CHANCE {chancePct}%
            </p>
          )}
        </div>
      )}

      {(stage === "copy" || stage === "done") && (
        <p
          className={`font-data text-sm text-nd-text-secondary ${
            stage === "copy" ? "animate-fade-in" : ""
          }`}
        >
          {copy}
        </p>
      )}

      {stage === "done" && (
        <button className="btn-neon text-xs" onClick={onComplete}>
          Continuar
        </button>
      )}
    </div>
  );
}
