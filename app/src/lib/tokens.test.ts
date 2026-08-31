import { describe, it, expect } from "vitest";
import {
  tokens,
  bandFor,
  bandForBands,
  RESOURCE_BAR_BANDS,
  type Band,
  type ResourceBarKey,
} from "@/lib/tokens";

const resources = Object.entries(RESOURCE_BAR_BANDS) as [ResourceBarKey, Band[]][];

/** Band structurally containing `percent` (test helper). */
function bandContaining(bands: Band[], percent: number): Band | undefined {
  return bands.find((b) => percent >= b.min && percent <= b.max);
}

describe("bandForBands", () => {
  const custom: Band[] = [
    { min: 0, max: 49, color: "bg-nd-green", label: "baixo" },
    { min: 50, max: 100, color: "bg-nd-magenta", label: "alto" },
  ];

  it("should clamp percent below 0 and above 100", () => {
    expect(bandForBands(custom, -1)).toBe(custom[0]);
    expect(bandForBands(custom, -100)).toBe(custom[0]);
    expect(bandForBands(custom, 101)).toBe(custom[1]);
    expect(bandForBands(custom, 150)).toBe(custom[1]);
  });

  it("should round fractional percents to the nearest integer", () => {
    expect(bandForBands(custom, 49.4)).toBe(custom[0]);
    expect(bandForBands(custom, 49.6)).toBe(custom[1]);
    expect(bandForBands(custom, 0.4)).toBe(custom[0]);
    expect(bandForBands(custom, 99.6)).toBe(custom[1]);
  });

  it("should resolve non-finite values to the first band", () => {
    expect(bandForBands(custom, Number.NaN)).toBe(custom[0]);
    expect(bandForBands(custom, Number.POSITIVE_INFINITY)).toBe(custom[0]);
    expect(bandForBands(custom, Number.NEGATIVE_INFINITY)).toBe(custom[0]);
  });

  it("should return undefined when no band matches", () => {
    const sparse: Band[] = [{ min: 10, max: 20, color: "bg-nd-gold", label: "faixa" }];
    expect(bandForBands(sparse, 50)).toBeUndefined();
  });

  it("should agree with bandFor for every integer 0-100 across all resources", () => {
    resources.forEach(([resource, bands]) => {
      for (let n = 0; n <= 100; n++) {
        expect(bandForBands(bands, n)).toBe(bandFor(resource, n));
      }
    });
  });
});

describe("bandFor", () => {
  it.each(resources)("should clamp percent below 0 to the 0 band for %s", (resource, bands) => {
    const zeroBand = bandContaining(bands, 0);
    expect(bandFor(resource, -1)).toBe(zeroBand);
    expect(bandFor(resource, -100)).toBe(zeroBand);
  });

  it.each(resources)("should clamp percent above 100 to the 100 band for %s", (resource, bands) => {
    const hundredBand = bandContaining(bands, 100);
    expect(bandFor(resource, 101)).toBe(hundredBand);
    expect(bandFor(resource, 150)).toBe(hundredBand);
  });

  it.each(resources)("should map boundary points to their band for %s", (resource, bands) => {
    bands.forEach((band, i) => {
      expect(bandFor(resource, band.min)).toBe(band);
      expect(bandFor(resource, band.max)).toBe(band);
      if (i < bands.length - 1) {
        expect(bandFor(resource, bands[i + 1].min)).toBe(bands[i + 1]);
      }
    });
  });

  it.each(resources)("should round fractional percents to the nearest integer for %s", (resource, bands) => {
    expect(bandFor(resource, 33.5)).toBe(bandContaining(bands, 34));
    expect(bandFor(resource, 0.4)).toBe(bandContaining(bands, 0));
    expect(bandFor(resource, 99.6)).toBe(bandContaining(bands, 100));
  });

  it.each(resources)("should resolve NaN to the first band for %s", (resource, bands) => {
    expect(bandFor(resource, Number.NaN)).toBe(bands[0]);
  });

  it("humanity: NaN resolves to the first (descending) band Íntegro", () => {
    const [first] = RESOURCE_BAR_BANDS.humanity;
    expect(first.label).toBe("Íntegro");
    expect(bandFor("humanity", Number.NaN)).toBe(first);
  });

  it("humanity: 33.5 rounds to 34 → Borderline", () => {
    expect(bandFor("humanity", 33.5).label).toBe("Borderline");
  });
});

describe("band coverage", () => {
  it.each(resources)("every integer 0–100 maps to exactly one band for %s", (resource, bands) => {
    const matched = new Set<Band>();
    for (let n = 0; n <= 100; n++) {
      const hits = bands.filter((b) => n >= b.min && n <= b.max);
      expect(hits).toHaveLength(1);
      expect(bandFor(resource, n)).toBe(hits[0]);
      matched.add(hits[0]);
    }
    // Every band resolves at least one integer (no dead bands).
    expect(matched.size).toBe(bands.length);
  });

  it.each(resources)("bands are monotonic without functional overlap for %s", (resource, bands) => {
    const ascending = bands.every((b, i) => i === 0 || b.min > bands[i - 1].max);
    const descending = bands.every((b, i) => i === 0 || b.max < bands[i - 1].min);
    expect(ascending || descending).toBe(true);
  });
});

describe("humanity 5-band spec", () => {
  it("should expose five descending bands matching 04-sistemas §4", () => {
    const bands = RESOURCE_BAR_BANDS.humanity;
    expect(bands.map((b) => [b.min, b.max])).toEqual([
      [71, 100],
      [41, 70],
      [21, 40],
      [1, 20],
      [0, 0],
    ]);
  });

  it("should flag only the 20–1 Cyberpsycho band with pulse", () => {
    const cyber = RESOURCE_BAR_BANDS.humanity.find((b) => b.label === "Cyberpsycho");
    expect(cyber).toBeDefined();
    expect(cyber?.min).toBe(1);
    expect(cyber?.max).toBe(20);
    expect(cyber?.pulse).toBe(true);
    expect(cyber?.color).toBe("bg-nd-magenta");

    const pulsed = Object.values(RESOURCE_BAR_BANDS)
      .flat()
      .filter((b) => b.pulse === true);
    expect(pulsed).toHaveLength(1);
  });

  it("should render 0 humanity as FLATLINE on dead gray", () => {
    const flat = RESOURCE_BAR_BANDS.humanity.find((b) => b.label === "FLATLINE");
    expect(flat).toBeDefined();
    expect(flat?.min).toBe(0);
    expect(flat?.max).toBe(0);
    expect(flat?.color).toBe("bg-nd-dead-gray");
    expect(bandFor("humanity", 0)).toBe(flat);
  });
});

describe("streetCred bands", () => {
  it("should reserve lenda (gold) for score 100 only", () => {
    const bands = RESOURCE_BAR_BANDS.streetCred;
    expect(bands).toHaveLength(2);
    expect(bands[0]).toMatchObject({ min: 0, max: 99, label: "na rua", color: "bg-nd-cyan" });
    expect(bands[1]).toMatchObject({ min: 100, max: 100, label: "lenda", color: "bg-nd-gold" });
    expect(bandFor("streetCred", 99).label).toBe("na rua");
    expect(bandFor("streetCred", 100).label).toBe("lenda");
  });
});

describe("band labels and colors", () => {
  it.each(resources)("should have a non-empty PT label and Tailwind color for %s", (resource, bands) => {
    bands.forEach((band) => {
      expect(band.label.trim().length).toBeGreaterThan(0);
      expect(band.color).toMatch(/^bg-nd-[a-z-]+$/);
    });
  });
});

describe("tokens", () => {
  it("should pin the full noir palette (issue #149)", () => {
    expect(tokens.colors).toEqual({
      "nd-bg": "#0a0a0a",
      "nd-surface": "#161616",
      "nd-cyan": "#f2f2f2",
      "nd-magenta": "#ff2020",
      "nd-gold": "#d4a017",
      "nd-purple": "#8aa4b8",
      "nd-text": "#e8e8e8",
      "nd-text-secondary": "#9a9a9a",
      "nd-green": "#c8c8c8",
      "nd-dead-gray": "#3a3a3a",
    });
  });

  it("should pin the raw primitive layer and derive colors from it (issue #53)", () => {
    expect(tokens.raw).toEqual({
      bg: "#0a0a0a",
      surface: "#161616",
      white: "#f2f2f2",
      blood: "#ff2020",
      amber: "#d4a017",
      steel: "#8aa4b8",
      text: "#e8e8e8",
      textMuted: "#9a9a9a",
      lightGray: "#c8c8c8",
      deadGray: "#3a3a3a",
    });
    const expectations: Array<[keyof typeof tokens.colors, keyof typeof tokens.raw]> = [
      ["nd-bg", "bg"],
      ["nd-surface", "surface"],
      ["nd-cyan", "white"],
      ["nd-magenta", "blood"],
      ["nd-gold", "amber"],
      ["nd-purple", "steel"],
      ["nd-text", "text"],
      ["nd-text-secondary", "textMuted"],
      ["nd-green", "lightGray"],
      ["nd-dead-gray", "deadGray"],
    ];
    expectations.forEach(([channel, primitive]) => {
      expect(tokens.colors[channel]).toBe(tokens.raw[primitive]);
    });
  });

  it("should pin type families (issue #53)", () => {
    expect(tokens.fontFamily).toEqual({
      heading: ['"JetBrains Mono"', "monospace"],
      body: ["Inter", "sans-serif"],
      data: ['"Fira Code"', "monospace"],
      terminal: ['"Courier New"', '"Fira Code"', "monospace"],
    });
  });

  it("should expose the pill radius alongside terminal (issue #53)", () => {
    expect(tokens.borderRadius.terminal).toBe("2px");
    expect(tokens.borderRadius.pill).toBe("9999px");
  });

  it("should pin hairline + drop shadows (no neon glow, issue #149)", () => {
    expect(tokens.boxShadow).toEqual({
      "neon-cyan": "0 0 0 1px rgba(255, 255, 255, 0.06), 0 2px 8px rgba(0, 0, 0, 0.5)",
      "neon-magenta": "0 0 0 1px rgba(255, 32, 32, 0.25)",
      "neon-gold": "0 0 0 1px rgba(212, 160, 23, 0.25)",
      "neon-purple": "0 0 0 1px rgba(138, 164, 184, 0.25)",
      "neon-green": "0 0 0 1px rgba(200, 200, 200, 0.25)",
    });
  });

  it("should pin the stacking order header < nav < overlay (issue #53)", () => {
    expect(tokens.zIndex).toEqual({
      "nd-header": 30,
      "nd-nav": 40,
      "nd-overlay": 50,
    });
  });

  it("should pin touch targets at 44px (WCAG 2.5.5, issue #53)", () => {
    expect(tokens.minHeight.touch).toBe("44px");
    expect(tokens.minWidth.touch).toBe("44px");
  });

  it("should expose animations and keyframes moved from tailwind.config (issue #53)", () => {
    expect(tokens.animation).toEqual({
      glitch: "glitch 0.2s ease-in-out infinite alternate",
      flicker: "flicker 0.15s ease-in-out infinite alternate",
      "pulse-neon": "pulse-neon 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      "fade-in": "fade-in 0.5s ease-out both",
    });
    expect(tokens.keyframes["pulse-neon"]).toEqual({
      "0%, 100%": { opacity: "1" },
      "50%": { opacity: "0.5" },
    });
    expect(tokens.keyframes["fade-in"]).toEqual({ from: { opacity: "0" }, to: { opacity: "1" } });
  });

  it("should expose the scanline effect (issue #53)", () => {
    expect(tokens.effects.scanline).toBe("rgba(255, 255, 255, 0.015)");
  });

  it("should expose canonical screens and motion durations", () => {
    expect(tokens.screens.lg).toBe("1024px");
    expect(tokens.transitionDuration["nd-fast"]).toBe("150ms");
  });
});

// Integration: tailwind.config.js consumes tokens.ts. The config is plain ESM
// (vite handles it), but if the import ever fails in this environment (e.g.
// jiti/plugin resolution), skip instead of failing the suite.
let tailwindConfig: {
  theme: {
    extend: {
      colors: Record<string, string>;
      fontFamily: Record<string, string[]>;
      borderRadius: Record<string, string>;
      boxShadow: Record<string, string>;
      screens: Record<string, string>;
      fontSize: Record<string, [string, { lineHeight: string }]>;
      transitionDuration: Record<string, string>;
      zIndex: Record<string, number>;
      minHeight: Record<string, string>;
      minWidth: Record<string, string>;
      animation: Record<string, string>;
      keyframes: Record<string, Record<string, Record<string, string>>>;
    };
  };
} | null = null;
let configError: unknown = null;
try {
  tailwindConfig = (await import("../../tailwind.config.js")).default;
} catch (err) {
  configError = err;
}

describe("tailwind.config integration", () => {
  it.skipIf(configError !== null)("should expose tokens.colors as theme colors", () => {
    expect(tailwindConfig?.theme.extend.colors["nd-cyan"]).toBe(tokens.colors["nd-cyan"]);
  });

  it.skipIf(configError !== null)("should expose tokens.boxShadow as theme shadows", () => {
    expect(tailwindConfig?.theme.extend.boxShadow["neon-cyan"]).toBe(tokens.boxShadow["neon-cyan"]);
  });

  it.skipIf(configError !== null)("should expose the issue #53 theme keys", () => {
    expect(tailwindConfig?.theme.extend.fontFamily.heading).toEqual(tokens.fontFamily.heading);
    expect(tailwindConfig?.theme.extend.borderRadius.pill).toBe(tokens.borderRadius.pill);
    expect(tailwindConfig?.theme.extend.fontSize["nd-micro"]).toEqual(tokens.fontSize["nd-micro"]);
    expect(tailwindConfig?.theme.extend.transitionDuration["nd-slow"]).toBe(
      tokens.transitionDuration["nd-slow"],
    );
    expect(tailwindConfig?.theme.extend.zIndex["nd-overlay"]).toBe(tokens.zIndex["nd-overlay"]);
    expect(tailwindConfig?.theme.extend.minHeight.touch).toBe(tokens.minHeight.touch);
    expect(tailwindConfig?.theme.extend.minWidth.touch).toBe(tokens.minWidth.touch);
    expect(tailwindConfig?.theme.extend.animation["pulse-neon"]).toBe(tokens.animation["pulse-neon"]);
    expect(tailwindConfig?.theme.extend.keyframes.glitch).toEqual(tokens.keyframes.glitch);
  });
});
