import { useEffect } from "react";
import { useStreetCredStore } from "@/stores/street-cred";
import { useAuthStore } from "@/stores/auth";

// ponytail: the server's StreetCredInfo carries the next threshold but not the
// current floor; the progress bar needs both, so the ladder is mirrored here.
// Keep in sync with STREET_CRED_THRESHOLDS in server/src/game/street-cred.ts.
const SC_THRESHOLDS = [0, 10, 25, 50, 75, 100] as const;

/** Highest threshold at or below `score` (the current rank's floor). */
function thresholdFloor(score: number): number {
  let floor: number = SC_THRESHOLDS[0];
  for (const t of SC_THRESHOLDS) {
    if (score >= t) floor = t;
    else break;
  }
  return floor;
}

/**
 * Header badge: ⭐ score · title + a progress bar toward the next threshold.
 * Gold "LEGEND" styling at 100 (no bar — the ladder is topped). Hidden on
 * error; skeleton shimmer while loading. Only renders for authenticated
 * characters (the endpoint 404s without one).
 */
export default function StreetCredDisplay() {
  const hasCharacter = useAuthStore((s) => !!s.character);
  const info = useStreetCredStore((s) => s.info);
  const loading = useStreetCredStore((s) => s.loading);
  const error = useStreetCredStore((s) => s.error);
  const fetchSC = useStreetCredStore((s) => s.fetchSC);

  useEffect(() => {
    if (hasCharacter) void fetchSC();
  }, [hasCharacter, fetchSC]);

  if (error) return <div className="hidden" />;

  // Skeleton shimmer while loading (or no data yet).
  if (!info || loading) {
    return (
      <div className="w-32 animate-pulse bg-nd-surface border border-nd-cyan/20 rounded-terminal px-3 py-2">
        <div className="h-3 w-20 bg-nd-cyan/20 rounded" />
        <div className="h-1.5 w-24 bg-nd-cyan/10 rounded mt-2" />
      </div>
    );
  }

  if (info.title === "Legend" || info.nextThreshold === null) {
    return (
      <div
        className="flex items-center gap-2 border border-nd-gold/60 rounded-terminal px-3 py-1.5 text-xs font-data shadow-neon-gold"
        title={`Street Cred ${info.score} — máximo atingido ${info.maxAchieved}`}
      >
        <span className="text-nd-gold">⭐</span>
        <span className="text-nd-gold">{info.score}</span>
        <span className="text-nd-gold/60">·</span>
        <span className="text-nd-gold tracking-widest">LEGEND</span>
      </div>
    );
  }

  const floor = thresholdFloor(info.score);
  const span = info.nextThreshold.score - floor;
  const percent = span > 0 ? Math.round(((info.score - floor) / span) * 100) : 100;

  return (
    <div
      className="flex flex-col gap-1 border border-nd-cyan/30 rounded-terminal px-3 py-1.5 text-xs font-data"
      title={`Street Cred ${info.score} — máximo atingido ${info.maxAchieved} · faltam ${info.scToNext} para ${info.nextThreshold.title}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-nd-cyan">⭐</span>
        <span className="text-nd-text">{info.score}</span>
        <span className="text-nd-text-secondary/60">·</span>
        <span className="text-nd-cyan tracking-widest">{info.title.toUpperCase()}</span>
      </div>
      <div className="h-1 w-28 bg-nd-bg rounded-full border border-nd-cyan/20 overflow-hidden">
        <div
          className="h-full bg-nd-cyan transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}
