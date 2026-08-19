import { useEffect, useRef, useState } from "react";
import type { GigEscapeResponse, GigExecuteResponse } from "@neon-dusk/shared";
import { GIG_PHASES } from "@neon-dusk/shared";
import { useGigStore } from "@/stores/gig";
import { GIG_PHASE_LABELS } from "@/lib/labels";
import { formatCountdown } from "@/lib/format";

/** Outcome chip — used for both execute and escape rolls. */
function OutcomeChip({
  label,
  outcome,
  roll,
  chance,
}: {
  label: string;
  outcome: string | null;
  roll?: number;
  chance?: number;
}) {
  if (!outcome) return null;
  const ok = outcome === "success";
  return (
    <div className="flex flex-wrap items-center gap-2 font-data text-xs">
      <span className={ok ? "text-nd-green" : "text-nd-magenta"}>
        {ok ? "✓" : "✗"} {label.toUpperCase()} {ok ? "BEM-SUCEDIDA" : "FALHOU"}
      </span>
      {roll !== undefined && chance !== undefined && roll >= 0 && (
        <span className="text-nd-text-secondary">
          (rolou {roll.toFixed(2)} vs {Math.round(chance * 100)}%)
        </span>
      )}
    </div>
  );
}

/**
 * The Despachante Cupim active-trampo panel: 5-step phase indicator, phase-specific
 * actions (legwork timer, execute/escape rolls, wrap-up payout) and the
 * post-wrap-up summary. Rendered by GigBoardView whenever an active trampo
 * exists OR a wrap-up summary is still on screen.
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

  // 1s clock for the legwork countdown.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset transient outcome state whenever the active trampo changes identity.
  const lastGigId = useRef<string | null>(null);
  const actionInFlight = useRef(false);
  useEffect(() => {
    if (activeGig?.id !== lastGigId.current) {
      lastGigId.current = activeGig?.id ?? null;
      setLastExecute(null);
      setLastEscape(null);
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
          Cupim conta a grana, ri alto e te dá um tapa nas costas. "Boa. Volta amanhã que tem mais."
        </p>
      </div>
    );
  }

  if (!activeGig) return null;

  const trampo = activeGig;
  const phaseIndex = GIG_PHASES.indexOf(trampo.phase as (typeof GIG_PHASES)[number]);
  const currentPhase = phaseIndex >= 0 ? phaseIndex : 0;

  // Legwork countdown (legworkStartedAt + legworkMinutes, now in seconds).
  const legworkStarted = trampo.legworkStartedAt ? new Date(trampo.legworkStartedAt).getTime() : null;
  const legworkEndsAt = legworkStarted ? legworkStarted + trampo.legworkMinutes * 1_000 : null;
  const legworkRemaining = legworkEndsAt ? Math.max(0, Math.ceil((legworkEndsAt - now) / 1000)) : 0;
  const legworkDone = trampo.legworkCompleted || (legworkEndsAt !== null && legworkRemaining === 0);

  async function onAction(action: () => Promise<unknown>): Promise<void> {
    if (actionInFlight.current) return; // guard against double-click
    actionInFlight.current = true;
    try {
      const res = (await action()) as GigExecuteResponse | GigEscapeResponse;
      if ("outcome" in res && "heatGenerated" in res) setLastEscape(res as GigEscapeResponse);
      else if ("outcome" in res) setLastExecute(res as GigExecuteResponse);
    } catch {
      // error already surfaced through actionError
    } finally {
      actionInFlight.current = false;
    }
  }

  return (
    <div className="card border-nd-purple/40 shadow-neon-purple space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-data text-[10px] uppercase tracking-widest text-nd-text-secondary">
            TRAMPO ATIVO // CUPIM · O PORTEIRO
          </p>
          <h3 className="font-heading text-xl text-nd-text">{trampo.gigName}</h3>
        </div>
        <span className="font-data text-[10px] uppercase tracking-widest border border-nd-purple/40 text-nd-purple rounded-terminal px-2 py-1">
          {trampo.gigTier.toUpperCase()} · {trampo.gigType.toUpperCase()}
        </span>
      </div>

      {/* Phase indicator — 5 steps */}
      <div className="flex items-center gap-1">
        {GIG_PHASES.map((phase, i) => (
          <div key={phase} className="flex-1 space-y-1">
            <div
              className={`h-1 rounded-full transition-colors ${
                i <= currentPhase ? "bg-nd-purple" : "bg-nd-bg border border-nd-purple/20"
              }`}
            ></div>
            <div
              className={`text-center font-data text-[9px] uppercase tracking-wider ${
                i === currentPhase ? "text-nd-purple" : "text-nd-text-secondary"
              }`}
            >
              {GIG_PHASE_LABELS[phase]}
            </div>
          </div>
        ))}
      </div>

      {/* Phase content */}
      {trampo.phase === "meet" && (
        <div className="space-y-3">
          <p className="text-nd-text-secondary text-sm">
            Cupim aperta tua mão e fala baixo: "{"Boa escolha, moleque. Não vacila, não morre, me traz o resultado."}"
          </p>
          <OutcomeChip label="Execução" outcome={trampo.executeOutcome} />
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
              className="h-full bg-nd-cyan transition-all duration-1000"
              style={{
                width: `${
                  legworkEndsAt
                    ? Math.max(0, 100 - (legworkRemaining / trampo.legworkMinutes) * 100)
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
            outcome={trampo.executeOutcome}
            roll={lastExecute?.outcome.roll}
            chance={lastExecute?.outcome.successChance}
          />
          {trampo.executeOutcome === "failure" && (
            <p className="text-nd-magenta text-sm">
              Deu ruim no meio do caminho. Cupim vai cobrar explicação — primeiro, sai daí.
            </p>
          )}
          {trampo.executeOutcome === "success" && (
            <p className="text-nd-green text-sm">
              Serviço limpo. Agora some da cena antes que a milícia chegue.
            </p>
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
            outcome={trampo.executeOutcome}
            roll={lastExecute?.outcome.roll}
            chance={lastExecute?.outcome.successChance}
          />
          <OutcomeChip
            label="Fuga"
            outcome={trampo.escapeOutcome}
            roll={lastEscape?.outcome.roll}
            chance={lastEscape?.outcome.successChance}
          />
          {lastEscape && lastEscape.heatGenerated > 0 && (
            <p className="font-data text-xs text-nd-magenta">
              +{lastEscape.heatGenerated} calor no distrito — a polícia andou te perguntando por nome.
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
            outcome={trampo.executeOutcome}
            roll={lastExecute?.outcome.roll}
            chance={lastExecute?.outcome.successChance}
          />
          <OutcomeChip
            label="Fuga"
            outcome={trampo.escapeOutcome}
            roll={lastEscape?.outcome.roll}
            chance={lastEscape?.outcome.successChance}
          />
          {lastEscape && lastEscape.heatGenerated > 0 && (
            <p className="font-data text-xs text-nd-magenta">
              +{lastEscape.heatGenerated} calor no distrito — a polícia andou te perguntando por nome.
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
