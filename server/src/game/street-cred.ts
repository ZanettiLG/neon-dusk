// Neon Dusk — Moral game logic (pure functions, no DB access)
// ============================================================================
// Conforme 04-sistemas-e-progressao.md §5: SC 0-100, thresholds gate content,
// decay -5/day after a 7-day inactivity grace, never below the highest
// threshold reached. RNG is injectable as the last parameter for testability
// (same convention as game/gigs.ts).

// ─── Types ──────────────────────────────────────────────────────────────────

/** One rank on the street-cred ladder. */
export interface StreetCredThreshold {
  score: number;
  title: string;
}

/** Result of applying inactivity decay. */
export interface DecayResult {
  /** Score points lost (0 when inside the grace period or at the floor). */
  decayAmount: number;
  /** Score after decay (never below the floor of `maxAchieved`). */
  effectiveScore: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * A escada de Moral (ascendente). Os degraus liberam tiers de trampo e
 * despachantes; chegar a 100 (Legend) é permanente e sobrevive aos resets.
 */
export const STREET_CRED_THRESHOLDS: readonly StreetCredThreshold[] = [
  { score: 0, title: "Unknown" },
  { score: 10, title: "Runner" },
  { score: 25, title: "Pro" },
  { score: 50, title: "Corredor" },
  { score: 75, title: "Elite" },
  { score: 90, title: "Lenda de SP" }, // provisório — 04-sistemas-e-progressao.md §5
  { score: 100, title: "Legend" },
];

/** Days of inactivity before decay starts. */
export const DECAY_GRACE_DAYS = 7;

/** Moral lost per full day past the grace period. */
export const DECAY_RATE_PER_DAY = 5;

/** SC award ranges per gig tier (inclusive) — 04-sistemas-e-progressao.md §5. */
const SC_AWARD_RANGES: Record<string, { min: number; max: number }> = {
  t1: { min: 1, max: 3 },
  t2: { min: 3, max: 8 },
  t3: { min: 10, max: 20 },
  t4: { min: 20, max: 30 },
  t5: { min: 30, max: 50 },
};

const DAY_MS = 86_400_000;

// ─── Functions ──────────────────────────────────────────────────────────────

/**
 * Title for a street-cred score: the highest threshold at or below it.
 * Scores above 100 (defensive) resolve to Legend; negative scores to Unknown.
 */
export function getTitle(score: number): string {
  let title = STREET_CRED_THRESHOLDS[0].title;
  for (const t of STREET_CRED_THRESHOLDS) {
    if (score >= t.score) title = t.title;
    else break;
  }
  return title;
}

/**
 * The next threshold strictly above a score, or null when the score already
 * tops the ladder (>= 100). For negative scores the first threshold (0,
 * Unknown) is returned.
 */
export function getNextThreshold(score: number): StreetCredThreshold | null {
  for (const t of STREET_CRED_THRESHOLDS) {
    if (t.score > score) return t;
  }
  return null;
}

/**
 * The decay floor for a lifetime max: the highest threshold at or below
 * `maxAchieved` (clamped to the 0-100 ladder).
 */
export function getThresholdFloor(maxAchieved: number): number {
  let floor = STREET_CRED_THRESHOLDS[0].score;
  for (const t of STREET_CRED_THRESHOLDS) {
    if (maxAchieved >= t.score) floor = t.score;
    else break;
  }
  return floor;
}

/**
 * Decay since the last activity, floor-clamped so reputation never falls
 * below the highest threshold reached.
 *
 * @param lastActivityAt - Last persisted activity timestamp (decay clock).
 * @param currentScore   - Persisted Moral.
 * @param maxAchieved    - Lifetime max (decay floor source).
 * @param now            - Current time (injectable for tests).
 * @returns The score delta and the effective score after decay.
 *
 * @edgecases Future `lastActivityAt` (clock skew) → 0 days → no decay.
 *            Score already at/below the floor → no decay, score unchanged.
 *            Fractional days truncate (7d 23h is still inside the grace).
 */
export function calculateDecay(
  lastActivityAt: Date,
  currentScore: number,
  maxAchieved: number,
  now: Date = new Date(),
): DecayResult {
  const days = Math.max(0, Math.floor((now.getTime() - lastActivityAt.getTime()) / DAY_MS));
  const rawDecay = Math.max(0, days - DECAY_GRACE_DAYS) * DECAY_RATE_PER_DAY;

  const floor = getThresholdFloor(maxAchieved);
  // Already at/below the floor (or defensive negative) — nothing to decay.
  if (currentScore <= floor) return { decayAmount: 0, effectiveScore: currentScore };

  const decayAmount = Math.min(rawDecay, currentScore - floor);
  return { decayAmount, effectiveScore: currentScore - decayAmount };
}

/**
 * Random street-cred award for a completed gig, per tier range
 * (T1 1-3 … T5 30-50): `min + floor(rng() * (max - min + 1))`.
 *
 * @param tier       - Gig tier ("t1".."t5", case-insensitive; unknown → 0).
 * @param difficulty - Reserved parameter (kept for call-site compatibility).
 * @param success    - Whether the gig succeeded (failed gigs award 0).
 * @param rng        - Uniform [0, 1) source (injectable for tests).
 */
export function calculateSCAward(
  tier: string,
  _difficulty: number,
  success: boolean,
  rng: () => number = Math.random,
): number {
  if (!success) return 0;
  const range = SC_AWARD_RANGES[tier.toLowerCase()];
  if (!range) return 0;
  return range.min + Math.floor(rng() * (range.max - range.min + 1));
}

/**
 * Backward-compatible alias for `calculateSCAward` (kept so existing gig
 * callers and history shape stay stable).
 */
export function calculateStreetCredAward(
  tier: string,
  difficulty: number,
  success: boolean,
  rng: () => number = Math.random,
): number {
  return calculateSCAward(tier, difficulty, success, rng);
}
