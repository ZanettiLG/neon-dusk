// @vitest-environment node
// WCAG 1.4.4 (Resize Text) regression guard for the meta viewport
// (issue #16). axe-core flags `user-scalable=no` and `maximum-scale=1.0` as
// zoom-blocking. The restriction was removed in #149; this test pins the
// runtime HTML so it can never be reintroduced. Reads app/index.html only —
// dist/ is a gitignored build artifact, not a source of truth.
// Paths resolved from import.meta.url, never process.cwd().

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const INDEX_HTML = join(dirname(fileURLToPath(import.meta.url)), "../../index.html");

const html = readFileSync(INDEX_HTML, "utf8");

describe("meta viewport (WCAG 1.4.4)", () => {
  it("should declare exactly one viewport meta tag", () => {
    const tags = html.match(/<meta[^>]*name=["']viewport["'][^>]*>/gi) ?? [];
    expect(tags).toHaveLength(1);
  });

  it("should not block browser zoom (no user-scalable / maximum-scale)", () => {
    const viewport = html.match(/<meta[^>]*name=["']viewport["'][^>]*>/i)?.[0] ?? "";
    expect(viewport.toLowerCase()).not.toMatch(/user-scalable/);
    expect(viewport.toLowerCase()).not.toMatch(/maximum-scale/);
  });

  it("should keep the responsive baseline (width=device-width, initial-scale=1.0)", () => {
    const content = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? "";
    expect(content).toContain("width=device-width");
    expect(content).toContain("initial-scale=1.0");
  });
});
