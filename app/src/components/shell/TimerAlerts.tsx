import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useGigStore } from "@/stores/gig";
import { useSaideiraStore } from "@/stores/saideira";
import { useCountdownTo } from "@/lib/useCountdownTo";
import { formatCountdown, formatDuration } from "@/lib/format";
import { ABILITY_LABELS } from "@/lib/labels";

/**
 * Single prioritized timer banner in the shell strip (issue #13):
 * 1. active trampo in legwork → "TRAMPO ATIVO · legwork m:ss";
 * 2. current round reset → "ROUND termina em Xd Yh";
 * 3. role ability ready → "{ability} pronta".
 * Renders nothing when no timer applies. Backs onto the trampo board + Saideira
 * hub, fetching both lazily on mount (best-effort, store-level error states).
 */
export default function TimerAlerts() {
  const character = useAuthStore((s) => s.character);
  const board = useGigStore((s) => s.board);
  const fetchBoard = useGigStore((s) => s.fetchBoard);
  const hub = useSaideiraStore((s) => s.hub);
  const fetchHub = useSaideiraStore((s) => s.fetchHub);

  useEffect(() => {
    if (!character) return;
    if (!board) void fetchBoard();
    if (!hub) void fetchHub();
  }, [character, board, hub, fetchBoard, fetchHub]);

  // Hooks run unconditionally (only one alert is displayed).
  const activeGig = board?.activeGig ?? null;
  const legworkEndsAt = activeGig?.legworkStartedAt
    ? new Date(activeGig.legworkStartedAt).getTime() + activeGig.legworkMinutes * 60_000
    : null;
  const legworkRemaining = useCountdownTo(legworkEndsAt);
  const legworkAlert =
    activeGig?.phase === "legwork" &&
    !activeGig.legworkCompleted &&
    legworkRemaining > 0;

  const roundEndsAtMs = hub ? Date.parse(hub.roundEndsAt) : NaN;
  const roundSeconds = useCountdownTo(Number.isFinite(roundEndsAtMs) ? roundEndsAtMs : null);
  const roundAlert = Number.isFinite(roundEndsAtMs) && roundSeconds > 0;

  const ability = character?.ability ?? null;
  const abilityAlert =
    ability !== null &&
    !ability.isActive &&
    (ability.cooldownUntil === null || Date.parse(ability.cooldownUntil) <= Date.now());

  let line: string | null = null;
  if (legworkAlert) {
    line = `TRAMPO ATIVO · legwork ${formatCountdown(legworkRemaining)}`;
  } else if (roundAlert) {
    line = `ROUND termina em ${formatDuration(roundSeconds)}`;
  } else if (abilityAlert && ability) {
    line = `${ABILITY_LABELS[ability.abilityType]} pronta`;
  }

  if (!line) return null;

  return (
    <div aria-live="polite" className="bg-nd-surface/95 border-b border-nd-gold/30 px-4 py-1.5">
      <p className="font-data text-xs text-nd-gold tracking-wider truncate">
        <span aria-hidden="true">▸ </span>
        {line}
      </p>
    </div>
  );
}
