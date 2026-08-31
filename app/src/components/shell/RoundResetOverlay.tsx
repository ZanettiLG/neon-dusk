import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { formatCountdown, formatDuration, formatEds } from "@/lib/format";
import { useCountdownTo } from "@/lib/useCountdownTo";
import { useAuthStore } from "@/stores/auth";
import type {
  RoundHistoryResponse,
  RoundInfoResponse,
  RoundStatsSnapshot,
} from "@neon-dusk/shared";

/** Polling cadence for the round state (cheap GET /api/round). */
const POLL_INTERVAL_MS = 60_000;
/** localStorage key persisting the last round the player dismissed. */
const DISMISS_KEY = "nd:round-dismissed";
/** Countdowns under 1h render as m:ss; the default intermission is 60 min. */
const ONE_HOUR_S = 3600;

/** Last dismissed round number from localStorage, or null. */
function readDismissedRound(): number | null {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Global round-reset blackout ("APAGÃO"): mounted once in App, it polls
 * GET /api/round every 60s and covers the whole screen while the round is in
 * the intermission (status === "intermission") unless the player already
 * dismissed THAT round. Auto-hides the moment the round returns to "active".
 * Best-effort: any fetch failure simply skips the overlay — the round system
 * never blocks play.
 */
export default function RoundResetOverlay() {
  const token = useAuthStore((s) => s.accessToken);
  const [round, setRound] = useState<RoundInfoResponse | null>(null);
  const [stats, setStats] = useState<RoundStatsSnapshot | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(readDismissedRound);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await api.get<RoundInfoResponse>("/api/round");
        if (cancelled) return;
        setRound(res);
        if (res.status === "intermission") {
          // Decorative round stats come from the most recently ended round.
          try {
            const hist = await api.get<RoundHistoryResponse>("/api/round/history?limit=1");
            if (!cancelled) setStats(hist.rounds[0]?.stats ?? null);
          } catch {
            // stats are decorative — a failure must not keep the overlay up
          }
        } else {
          setStats(null);
        }
      } catch {
        // best-effort: no overlay when the round endpoint is unreachable
      }
    }

    void poll();
    const id = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  // The 1s countdown clock runs unconditionally (useCountdownTo(null) → 0).
  const intermissionEndsAt = round?.intermissionUntil ? Date.parse(round.intermissionUntil) : NaN;
  const countdownSeconds = useCountdownTo(
    Number.isFinite(intermissionEndsAt) ? intermissionEndsAt : null,
  );

  const visible =
    round !== null && round.status === "intermission" && round.roundNumber !== dismissed;
  if (!visible) return null;

  const dismiss = () => {
    if (!round) return;
    localStorage.setItem(DISMISS_KEY, String(round.roundNumber));
    setDismissed(round.roundNumber);
  };

  const countdown =
    countdownSeconds < ONE_HOUR_S
      ? formatCountdown(countdownSeconds)
      : formatDuration(countdownSeconds);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Apagão de rodada"
      className="fixed inset-0 z-nd-overlay flex items-center justify-center bg-nd-bg/95 p-4"
    >
      <div className="w-full max-w-md space-y-4 text-center">
        <h2 className="font-heading text-3xl tracking-widest text-nd-magenta animate-glitch">
          APAGÃO
        </h2>
        <p className="font-data text-xs uppercase tracking-widest text-nd-text-secondary">
          RODADA {round.roundNumber} ENCERRADA
        </p>
        <p className="font-data text-3xl text-nd-gold" role="status">
          {countdown}
        </p>
        {stats && (
          <div className="space-y-1 font-data text-xs text-nd-text">
            <p>Trampos completos: {stats.totalGigsCompleted}</p>
            <p>Grana gerada: {formatEds(stats.totalEddiesEarned)}</p>
            <p>Lutas PvP: {stats.totalPvpFights}</p>
            <p>Corredores ativos: {stats.totalActiveCharacters}</p>
            {stats.topScCharacterName && <p>Lenda da rodada: {stats.topScCharacterName}</p>}
          </div>
        )}
        <p className="text-sm italic text-nd-text-secondary">
          “As Lendas sobrevivem. O drink no menu da Saideira é eterno.”
        </p>
        <button type="button" className="btn-neon" onClick={dismiss}>
          FECHAR
        </button>
      </div>
    </div>
  );
}
