import { vi } from "vitest";

/**
 * Shared test helper: jsdom has no `window.matchMedia`, so components guarded
 * by prefers-reduced-motion need a stub to test both flag states.
 *
 * Usage: `stubMatchMedia(true|false)` in the test body and
 * `restoreMatchMedia()` in `afterEach` (the stub is global window state).
 * The original value is captured at module scope on first import — identical
 * to the per-suite stubs this helper replaces.
 */

const originalMatchMedia = window.matchMedia;

/** Stubs `window.matchMedia` with a `MediaQueryList`-shaped object whose
 * `matches` is the given value (controls `prefers-reduced-motion` guards). */
export function stubMatchMedia(matches: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

/** Restores the original (absent, in jsdom) `window.matchMedia` so other
 * suites are unaffected. */
export function restoreMatchMedia(): void {
  window.matchMedia = originalMatchMedia;
}
