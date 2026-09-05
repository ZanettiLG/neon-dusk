import { describe, it, expect } from "vitest";
import { CHROME_ICON_ASSETS } from "./icons";

// Issue #188 emenda 1 §E1.5: CHROME_ICON_ASSETS is the slug→url contract the
// ChromeIcon consumes (renders <img> when the slug has an entry, monogram
// fallback otherwise). Empty during #188 — the 12 item icons are the #189
// sub-issue (asset-forge). Populating it must be a zero-diff delivery; the
// Record<string, string> shape is enforced at compile time.

describe("CHROME_ICON_ASSETS", () => {
  it("should be an empty slug→url map during #188 (the 12 icons ship in #189)", () => {
    expect(CHROME_ICON_ASSETS).toEqual({});
  });
});