import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tokens } from "@/lib/tokens";
import { buildTokensCss } from "@/lib/tokens-css";

describe("buildTokensCss", () => {
  it("should match the committed src/tokens.css byte-for-byte", () => {
    const generated = buildTokensCss(tokens);
    const committed = readFileSync(join(process.cwd(), "src", "tokens.css"), "utf8");
    expect(generated, "tokens.css desatualizado — rode `npm run tokens:generate`").toBe(committed);
  });

  it("should derive the focus ring from the nd-cyan channel (issue #53, D5)", () => {
    const css = buildTokensCss(tokens);
    expect(css).toContain(`--nd-focus-color: ${tokens.colors["nd-cyan"]};`);
    expect(css).toContain("--nd-focus-width: 2px;");
    expect(css).toContain("--nd-focus-offset: 2px;");
  });

  it("should emit the scanline, touch target and z-index layers", () => {
    const css = buildTokensCss(tokens);
    expect(css).toContain(`--nd-scanline: ${tokens.effects.scanline};`);
    expect(css).toContain(`--nd-touch-target: ${tokens.minHeight.touch};`);
    expect(css).toContain("--nd-z-header: 30;");
    expect(css).toContain("--nd-z-nav: 40;");
    expect(css).toContain("--nd-z-overlay: 50;");
  });

  it("should emit every color, radius, shadow and duration as a custom property", () => {
    const css = buildTokensCss(tokens);
    for (const [key, value] of Object.entries(tokens.colors)) {
      expect(css).toContain(`--${key}: ${value};`);
    }
    for (const [key, value] of Object.entries(tokens.borderRadius)) {
      expect(css).toContain(`--nd-radius-${key}: ${value};`);
    }
    for (const [key, value] of Object.entries(tokens.boxShadow)) {
      expect(css).toContain(`--nd-shadow-${key}: ${value};`);
    }
    for (const [key, value] of Object.entries(tokens.transitionDuration)) {
      expect(css).toContain(`--nd-duration-${key.replace(/^nd-/, "")}: ${value};`);
    }
  });
});
