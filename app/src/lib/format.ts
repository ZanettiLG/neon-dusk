// Formatting helpers shared across views and components.

/** Seconds → "m:ss" countdown (e.g. 95 → "1:35"). */
export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
