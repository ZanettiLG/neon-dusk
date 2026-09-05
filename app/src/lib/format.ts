// Formatting helpers shared across views and components.

/** Seconds → "m:ss" countdown (e.g. 95 → "1:35"). */
export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Seconds → compact cooldown label (#187 — trampo per-tier progression spans
 * 5s to 24h, so "m:ss" is useless at both ends): 5s → "5s", 60 → "1min",
 * 900 → "15min", 7200 → "2h", 86400 → "24h", 172800 → "2d".
 */
export function formatCooldown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
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

/** Integer grana → "G$ 1.234" (pt-BR grouping). Moved out of EconomyView for
 * the HUD and every other wallet readout. */
export function formatEds(amount: number): string {
  return `G$ ${amount.toLocaleString("pt-BR")}`;
}

/** Seconds → "Xd Yh" with zero units omitted (e.g. 90000 → "1d 1h",
 *  86400 → "1d", 3600 → "1h", 0 → "0h"). Used by round-reset countdowns and
 *  the consumables cooldown readout (issue #48). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  if (d > 0 && h > 0) return `${d}d ${h}h`;
  if (d > 0) return `${d}d`;
  return `${h}h`;
}
