import { useEffect, useState } from "react";

/**
 * Seconds remaining until `endsAt` (epoch ms), floored at 0, re-evaluated
 * every second while time remains. Returns 0 when `endsAt` is null or in the
 * past. Extracted from the ActiveGigPanel legwork countdown so other timers
 * (HUD alerts, round resets) reuse the same 1s-clock pattern.
 *
 * The interval lives in a useEffect and the updater is a pure `Date.now()`
 * read — StrictMode-safe (see react-patterns "Timers & Countdown").
 */
export function useCountdownTo(endsAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  const ticking = endsAt !== null && endsAt > now;

  // Rebase the clock when the deadline changes (e.g. null → future after a
  // 429 cooldown) so the first render doesn't use the mount-time `now`.
  useEffect(() => {
    setNow(Date.now());
  }, [endsAt]);

  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  if (endsAt === null) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
