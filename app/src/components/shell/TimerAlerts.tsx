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
  const abilityCooldownEndsAt =
    ability !== null && !ability.isActive && ability.cooldownUntil
      ? Date.parse(ability.cooldownUntil)
      : NaN;
  // Run the 1s clock while the cooldown is in the future so the "ready" alert
  // flips in place at expiry without needing navigation (review fix).
  const abilityCooldownRemaining = useCountdownTo(
    Number.isFinite(abilityCooldownEndsAt) ? abilityCooldownEndsAt : null
  );
  const abilityAlert =
    ability !== null &&
    !ability.isActive &&
    (ability.cooldownUntil === null || abilityCooldownRemaining <= 0);

  // Label is stable per alert type; countdown ticks every second. The label
  // alone sits in the aria-live region so only alert-type changes (e.g.
  // "TRAMPO ATIVO" → "ROUND termina") are announced, not each 1s tick.
  let label: string | null = null;
  let countdown: string | null = null;
  if (legworkAlert) {
    label = "TRAMPO ATIVO · legwork";
    countdown = formatCountdown(legworkRemaining);
  } else if (roundAlert) {
    label = "ROUND termina em";
    // Short-form m:ss under 1h (round end is imminent), long-form above.
    countdown =
      roundSeconds < 3600
        ? formatCountdown(roundSeconds)
        : formatDuration(roundSeconds);
  } else if (abilityAlert && ability) {
    label = `${ABILITY_LABELS[ability.abilityType]} pronta`;
  }

  if (label === null) return null;

  return (
    <div className="bg-nd-surface/95 border-b border-nd-gold/30 px-4 py-1.5">
      <p className="font-data text-xs text-nd-gold tracking-wider truncate">
        <span aria-hidden="true">▸ </span>
        <span aria-live="polite">{label}</span>
        {countdown !== null && <span> {countdown}</span>}
      </p>
    </div>
  );
}
