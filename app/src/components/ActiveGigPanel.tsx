import { useEffect, useRef, useState } from "react";
import type { GigEscapeResponse, GigExecuteResponse, GigPhase } from "@neon-dusk/shared";
import { GIG_PHASES } from "@neon-dusk/shared";
import { useGigStore } from "@/stores/gig";
import { GIG_PHASE_LABELS } from "@/lib/labels";
import { formatCountdown } from "@/lib/format";
import { useCountdownTo } from "@/lib/useCountdownTo";
import { gigCopy } from "@/lib/gig-copy";
import RollTheater from "@/components/RollTheater";
import { OutcomeChip, PhaseStepper } from "@/components/ui";
import type { Outcome } from "@/components/ui";

/** Narrows the ActiveGig string outcome to the shared Outcome union (unknown → null). */
function toOutcome(value: string | null): Outcome {
  return value === "success" || value === "failure" || value === "critical" ? value : null;
}

/**
 * The Despachante Cupim active-trampo panel: PhaseStepper progress indicator,
 * phase-specific actions (legwork timer, execute/escape rolls, wrap-up payout)
 * and the post-wrap-up summary. A fresh execute/escape response opens the
 * RollTheater in place of the phase content; dismissing it reveals the next
 * phase (the store already patched `board.activeGig` from the server truth).
 */
export default function ActiveGigPanel() {
  const activeGig = useGigStore((s) => s.board?.activeGig ?? null);
  const actionLoading = useGigStore((s) => s.actionLoading);
  const actionError = useGigStore((s) => s.actionError);
  const lastWrapup = useGigStore((s) => s.lastWrapup);
  const doLegwork = useGigStore((s) => s.doLegwork);
  const executeGig = useGigStore((s) => s.executeGig);
  const escapeGig = useGigStore((s) => s.escapeGig);
  const wrapUpGig = useGigStore((s) => s.wrapUpGig);
  const abandonGig = useGigStore((s) => s.abandonGig);

  // Roll details live only in the action responses (the trampo row keeps outcomes).
  const [lastExecute, setLastExecute] = useState<GigExecuteResponse | null>(null);
  const [lastEscape, setLastEscape] = useState<GigEscapeResponse | null>(null);
  /** Heat from the escape response — persists in the phase content after the theater closes. */
  const [escapeHeat, setEscapeHeat] = useState<number | null>(null);

  // 1s clock for the legwork countdown — shared hook (useCountdownTo), only
  // ticks while time actually remains.
  const legworkEndsAt = activeGig?.legworkStartedAt
    ? new Date(activeGig.legworkStartedAt).getTime() + activeGig.legworkMinutes * 60_000
    : null;
  const legworkRemaining = useCountdownTo(legworkEndsAt);

  // Reset transient outcome state whenever the active trampo changes identity.
  const lastGigId = useRef<string | null>(null);
  const actionInFlight = useRef(false);
  useEffect(() => {
    if (activeGig?.id !== lastGigId.current) {
      lastGigId.current = activeGig?.id ?? null;
      setLastExecute(null);
      setLastEscape(null);
      setEscapeHeat(null);
    }
  }, [activeGig?.id]);

  // --- Wrap-up summary (no active trampo left) ----------------------------------
  if (!activeGig && lastWrapup) {
    return (
      <div className="card border-nd-gold/40 shadow-neon-gold space-y-3">
        <p className="font-heading text-nd-gold tracking-widest">TRAMPO RESOLVIDO</p>
        <p className="font-data text-3xl text-nd-gold animate-pulse-neon">
          G$ {lastWrapup.payout.toLocaleString("pt-BR")}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-data text-xs">
          <span className="text-nd-text-secondary">Outcome</span>
          <span className={lastWrapup.outcome === "success" ? "text-nd-green" : "text-nd-magenta"}>
            {lastWrapup.outcome.toUpperCase()}
          </span>
          <span className="text-nd-text-secondary">Moral</span>
          <span className="text-nd-purple">+{lastWrapup.streetCredGained}</span>
          <span className="text-nd-text-secondary">Calor</span>
          <span className="text-nd-magenta">+{lastWrapup.heatAccumulated}</span>
          <span className="text-nd-text-secondary">Saldo</span>
          <span className="text-nd-cyan">G$ {lastWrapup.newBalance.toLocaleString("pt-BR")}</span>
        </div>
        <p className="text-nd-text-secondary text-xs font-data">
          {gigCopy("wrapup", lastWrapup.outcome === "success")}
        </p>
      </div>
    );
  }

  if (!activeGig) return null;

  const trampo = activeGig;
  const phaseIndex = GIG_PHASES.indexOf(trampo.phase as GigPhase);
  const currentIndex = phaseIndex >= 0 ? phaseIndex : 0;
  // Failed phases render as "!" (magenta): execute = index 2, escape = index 3.
  // Escape failure takes precedence — it is the most recent roll.
  const errorIndex =
    trampo.escapeOutcome === "failure" ? 3 : trampo.executeOutcome === "failure" ? 2 : undefined;

  const legworkDone = trampo.legworkCompleted || (legworkEndsAt !== null && legworkRemaining === 0);

  async function onAction(action: () => Promise<unknown>): Promise<void> {
    if (actionInFlight.current) return; // guard against double-click
    actionInFlight.current = true;
    try {
      const res = (await action()) as GigExecuteResponse | GigEscapeResponse;
      if ("outcome" in res && "heatGenerated" in res) {
        setLastEscape(res as GigEscapeResponse);
        setEscapeHeat((res as GigEscapeResponse).heatGenerated);
      } else if ("outcome" in res) {
        setLastExecute(res as GigExecuteResponse);
      }
    } catch {
      // error already surfaced through actionError
    } finally {
      actionInFlight.current = false;
    }
  }

  // Fresh (undismissed) roll response → theater replaces the phase content.
  // The escape roll is the most recent action, so it takes precedence.
  // Only the EXECUÇÃO theater carries the chance breakdown (issue #2) — the
  // escape response has no baseChance/modifiers to explain.
  const theater = lastEscape
    ? {
        label: "FUGA",
        outcome: lastEscape.outcome,
        copy: gigCopy("escape", lastEscape.outcome.success),
        dismiss: () => setLastEscape(null),
      }
    : lastExecute
      ? {
          label: "EXECUÇÃO",
          outcome: lastExecute.outcome,
          copy: gigCopy("execute", lastExecute.outcome.success),
          dismiss: () => setLastExecute(null),
          chanceBreakdown: {
            baseChance: lastExecute.outcome.baseChance,
            modifiers: lastExecute.outcome.modifiers,
          },
        }
      : null;

  const phases = GIG_PHASES.map((p) => ({ id: p, label: GIG_PHASE_LABELS[p] }));

  return (
    <div className="card border-nd-purple/40 shadow-neon-purple space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-data text-nd-micro uppercase tracking-widest text-nd-text-secondary">
            TRAMPO ATIVO // CUPIM · O PORTEIRO
          </p>
          <h3 className="font-heading text-xl text-nd-text">{trampo.gigName}</h3>
        </div>
        <span className="font-data text-nd-micro uppercase tracking-widest border border-nd-purple/40 text-nd-purple rounded-terminal px-2 py-1">
          {trampo.gigTier.toUpperCase()} · {trampo.gigType.toUpperCase()}
        </span>
      </div>

      {/* Phase indicator — 5 steps */}
      <PhaseStepper phases={phases} currentIndex={currentIndex} errorIndex={errorIndex} size="sm" />

      {/* Phase content (or the roll theater over it) */}
      {theater ? (
        <RollTheater
          label={theater.label}
          outcome={theater.outcome}
          copy={theater.copy}
          onComplete={theater.dismiss}
          chanceBreakdown={"chanceBreakdown" in theater ? theater.chanceBreakdown : undefined}
        />
      ) : (
        <>
          {trampo.phase === "meet" && (
            <div className="space-y-3">
              <p className="text-nd-text-secondary text-sm">
                Cupim aperta tua mão e fala baixo: "
                {"Boa escolha, moleque. Não vacila, não morre, me traz o resultado."}"
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-neon text-xs"
                  disabled={actionLoading}
                  onClick={() => void onAction(() => doLegwork(trampo.gigId))}
                >
                  Legwork (+20%)
                </button>
                <button
                  className="btn-neon text-xs border-nd-gold text-nd-gold bg-nd-gold/10 hover:bg-nd-gold/20"
                  disabled={actionLoading}
                  onClick={() => void onAction(() => executeGig(trampo.gigId))}
                >
                  Executar direto (-20%)
                </button>
              </div>
            </div>
          )}

          {trampo.phase === "legwork" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between font-data text-xs">
                <span className="text-nd-text-secondary">Investigando o terreno...</span>
                {legworkDone ? (
                  <span className="text-nd-green">✓ +20% sucesso</span>
                ) : (
                  <span className="text-nd-cyan">{formatCountdown(legworkRemaining)}</span>
                )}
              </div>
              <div className="h-1.5 w-full bg-nd-bg rounded-full border border-nd-cyan/20 overflow-hidden">
                <div
                  className="h-full bg-nd-cyan transition-all duration-nd-slow"
                  style={{
                    width: `${
                      legworkEndsAt
                        ? Math.max(0, 100 - (legworkRemaining / (trampo.legworkMinutes * 60)) * 100)
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
              <button
                className="btn-neon text-xs"
                disabled={actionLoading || !legworkDone}
                title={legworkDone ? undefined : "Aguarde o timer do legwork"}
                onClick={() => void onAction(() => executeGig(trampo.gigId))}
              >
                Executar
              </button>
            </div>
          )}

          {trampo.phase === "execute" && (
            <div className="space-y-3">
              <OutcomeChip
                label="Execução"
                outcome={toOutcome(trampo.executeOutcome)}
                roll={lastExecute?.outcome.roll}
                chance={lastExecute?.outcome.successChance}
              />
              {trampo.executeOutcome === "failure" && (
                <p className="text-nd-magenta text-sm">{gigCopy("execute", false)}</p>
              )}
              {trampo.executeOutcome === "success" && (
                <p className="text-nd-green text-sm">{gigCopy("execute", true)}</p>
              )}
              <button
                className="btn-neon text-xs"
                disabled={actionLoading}
                onClick={() => void onAction(() => escapeGig(trampo.gigId))}
              >
                Fugir / Extração
              </button>
            </div>
          )}

          {trampo.phase === "escape" && (
            <div className="space-y-3">
              <OutcomeChip
                label="Execução"
                outcome={toOutcome(trampo.executeOutcome)}
                roll={lastExecute?.outcome.roll}
                chance={lastExecute?.outcome.successChance}
              />
              <OutcomeChip
                label="Fuga"
                outcome={toOutcome(trampo.escapeOutcome)}
                roll={lastEscape?.outcome.roll}
                chance={lastEscape?.outcome.successChance}
              />
              {escapeHeat !== null && escapeHeat > 0 && (
                <p className="font-data text-xs text-nd-magenta">
                  +{escapeHeat} calor no distrito — a polícia andou te perguntando por nome.
                </p>
              )}
              <button
                className="btn-neon text-xs border-nd-gold text-nd-gold bg-nd-gold/10 hover:bg-nd-gold/20"
                disabled={actionLoading}
                onClick={() => void wrapUpGig(trampo.gigId).catch(() => undefined)}
              >
                Concluir trampo (receber)
              </button>
            </div>
          )}

          {trampo.phase === "wrap_up" && (
            <div className="space-y-3">
              <OutcomeChip
                label="Execução"
                outcome={toOutcome(trampo.executeOutcome)}
                roll={lastExecute?.outcome.roll}
                chance={lastExecute?.outcome.successChance}
              />
              <OutcomeChip
                label="Fuga"
                outcome={toOutcome(trampo.escapeOutcome)}
                roll={lastEscape?.outcome.roll}
                chance={lastEscape?.outcome.successChance}
              />
              {escapeHeat !== null && escapeHeat > 0 && (
                <p className="font-data text-xs text-nd-magenta">
                  +{escapeHeat} calor no distrito — a polícia andou te perguntando por nome.
                </p>
              )}
              <button
                className="btn-neon text-xs border-nd-gold text-nd-gold bg-nd-gold/10 hover:bg-nd-gold/20"
                disabled={actionLoading}
                onClick={() => void wrapUpGig(trampo.gigId).catch(() => undefined)}
              >
                Concluir trampo (receber)
              </button>
            </div>
          )}
        </>
      )}

      {/* Abandon — visible in all phases */}
      <button
        onClick={() => {
          if (
            trampo &&
            window.confirm(
              "Tem certeza que quer abandonar este trampo? O despachante não vai gostar.",
            )
          ) {
            void abandonGig(trampo.gigId);
          }
        }}
        disabled={actionLoading}
        className="px-3 py-1.5 text-sm border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
      >
        Abandonar trampo
      </button>

      {actionError && <p className="font-data text-xs text-nd-magenta">✗ {actionError}</p>}
    </div>
  );
}
