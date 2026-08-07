// Formatting helpers shared across views and components.

/** Seconds → "m:ss" countdown (e.g. 95 → "1:35"). */
export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** ISO timestamp → "agora" / "há N min" / "há N h" / "há N d" (pt-BR). */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < 60_000) return "agora";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}
