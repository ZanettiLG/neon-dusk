import type { StreetCredInfo } from "@neon-dusk/shared";

/**
 * Moral rank-up detection + ladder mirror (frontend-only).
 *
 * The server owns the canonical ladder (`server/src/game/street-cred.ts`); this
 * module duplicates it because the ladder lives in neither `packages/shared`
 * nor the app bundle. Drift is mitigated by the pinning test in
 * `street-cred.test.ts` (ADR 0002). Upgrade path: move the ladder into
 * `packages/shared` in a dedicated refactor.
 */

/** One rank on the street-cred ladder — mirrors the server exactly. */
export interface StreetCredThreshold {
  score: number;
  title: string;
}

/**
 * A escada de Moral (ascendente). Mirrors `STREET_CRED_THRESHOLDS` in
 * `server/src/game/street-cred.ts` — keep in sync; the pinning test guards it.
 */
export const STREET_CRED_THRESHOLDS: readonly StreetCredThreshold[] = [
  { score: 0, title: "Zé Ninguém" },
  { score: 10, title: "Perna" },
  { score: 25, title: "Pro" },
  { score: 50, title: "Corredor" },
  { score: 75, title: "Elite" },
  { score: 90, title: "Lenda de SP" },
  { score: 100, title: "Lenda" },
];

/** localStorage key persisting the last title the player has seen. */
export const LAST_SEEN_TITLE_KEY = "nd:last-seen-title";

/** A title-crossing worth celebrating. */
export interface RankUpEvent {
  /** New title reached (e.g. "Pro"). */
  title: string;
  /** Live score at the moment of the fetch that detected the crossing. */
  score: number;
  /** Ladder score of the new title (e.g. 25 for "Pro"). */
  threshold: number;
}

/** Index of a title in the ladder (0-based), or -1 when unknown. */
export function titleIndex(title: string): number {
  return STREET_CRED_THRESHOLDS.findIndex((t) => t.title === title);
}

/** Ladder score for a title, or null when the title is not on the ladder. */
export function thresholdForTitle(title: string): number | null {
  const threshold = STREET_CRED_THRESHOLDS.find((t) => t.title === title);
  return threshold ? threshold.score : null;
}

/**
 * Detect a rank-up by comparing the live title against the last seen one
 * (persisted in localStorage). Semantics:
 * 1. Reads the previous title from localStorage;
 * 2. ALWAYS writes the current title back (first visit and decay update it too);
 * 3. no previous title → null (first visit);
 * 4. same title → null;
 * 5. ladder index of current <= index of previous → null (decay);
 * 6. otherwise → one event for the new title, even when multiple steps were
 *    crossed in a single fetch.
 */
export function detectRankUp(info: StreetCredInfo): RankUpEvent | null {
  const prev = window.localStorage.getItem(LAST_SEEN_TITLE_KEY);
  window.localStorage.setItem(LAST_SEEN_TITLE_KEY, info.title);

  if (prev === null) return null;
  if (info.title === prev) return null;

  const currentIndex = titleIndex(info.title);
  const prevIndex = titleIndex(prev);
  if (currentIndex < 0 || prevIndex < 0) return null;
  if (currentIndex <= prevIndex) return null; // decay or lateral move

  const threshold = thresholdForTitle(info.title);
  if (threshold === null) return null;
  return { title: info.title, score: info.score, threshold };
}
