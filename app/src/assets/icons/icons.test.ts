// @vitest-environment node
// Curation tests for the P0 icon set (issue #137). Validates every hand-coded
// SVG against the style guide and the curation checklist from
// docs/design/04-pipeline-ia-e-prompts.md, and cross-checks the manifest
// (docs/design/asset-manifest.json v0.2.0). No XML parser — string/regex
// asserts only, zero new dependencies. Paths resolved from import.meta.url,
// never process.cwd().

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICONS_DIR = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(ICONS_DIR, "../../../../docs/design/asset-manifest.json");

const svgFiles = readdirSync(ICONS_DIR)
  .filter((f) => f.endsWith(".svg"))
  .sort();

type Asset = {
  id: string;
  category: string;
  name: string;
  description: string;
  alt: string;
  usage: string;
  file: string;
  colorToken: string;
};

const manifest = JSON.parse(
  readFileSync(MANIFEST_PATH, "utf8"),
) as { version: string; assets: Asset[] };

const readSvg = (file: string) => readFileSync(join(ICONS_DIR, file), "utf8");

// Canonical id → {name, alt} (curation rule #3): brand PT-BR names, no IP.
const CANONICAL: Record<string, { name: string; alt: string }> = {
  "icon-attr-bod": { name: "Body", alt: "Ícone do atributo Body" },
  "icon-attr-ref": { name: "Reflexes", alt: "Ícone do atributo Reflexes" },
  "icon-attr-int": { name: "Intelligence", alt: "Ícone do atributo Intelligence" },
  "icon-attr-tec": { name: "Technical", alt: "Ícone do atributo Technical" },
  "icon-attr-col": { name: "Cool", alt: "Ícone do atributo Cool" },
  "icon-role-bicho": { name: "Bicho", alt: "Ícone da banca Bicho" },
  "icon-role-vulto": { name: "Vulto", alt: "Ícone da banca Vulto" },
  "icon-role-gambiarrista": { name: "Gambiarrista", alt: "Ícone da banca Gambiarrista" },
  "icon-role-despachante": { name: "Despachante", alt: "Ícone da banca Despachante" },
  "icon-role-estradeiro": { name: "Estradeiro", alt: "Ícone da banca Estradeiro" },
  "icon-action-atacar": { name: "Atacar", alt: "Ícone da ação Atacar" },
  "icon-action-instalar": { name: "Instalar", alt: "Ícone da ação Instalar" },
  "icon-action-hackear": { name: "Hackear", alt: "Ícone da ação Hackear" },
  "icon-action-entregar": { name: "Entregar", alt: "Ícone da ação Entregar" },
  "icon-action-negociar": { name: "Negociar", alt: "Ícone da ação Negociar" },
  "icon-res-nil": { name: "NIL", alt: "Ícone do recurso NIL" },
  "icon-res-humanidade": { name: "Humanidade", alt: "Ícone do recurso Humanidade" },
  "icon-res-grana": { name: "Grana", alt: "Ícone do recurso Grana" },
  "icon-res-moral": { name: "Moral", alt: "Ícone do recurso Moral" },
  "icon-res-ram": { name: "RAM", alt: "Ícone do recurso RAM" },
  "icon-res-trace": { name: "Trace", alt: "Ícone do recurso Trace" },
  "icon-frame-comum": { name: "Moldura Comum", alt: "Moldura comum de card" },
  "icon-frame-raro": { name: "Moldura Rara", alt: "Moldura rara de card" },
  "icon-frame-elite": { name: "Moldura Elite", alt: "Moldura elite de card" },
  "icon-frame-lendario": { name: "Moldura Lendária", alt: "Moldura lendária de card" },
  "icon-tier-t1": { name: "Tier 1", alt: "Badge de tier 1" },
  "icon-tier-t2": { name: "Tier 2", alt: "Badge de tier 2" },
  "icon-tier-t3": { name: "Tier 3", alt: "Badge de tier 3" },
  "icon-tier-t4": { name: "Tier 4", alt: "Badge de tier 4" },
  "icon-tier-t5": { name: "Tier 5", alt: "Badge de tier 5" },
  "icon-state-sucesso": { name: "Sucesso", alt: "Ícone de estado Sucesso" },
  "icon-state-risco": { name: "Risco", alt: "Ícone de estado Risco" },
  "icon-state-cooldown": { name: "Cooldown", alt: "Ícone de estado Cooldown" },
  "icon-state-bloqueado": { name: "Bloqueado", alt: "Ícone de estado Bloqueado" },
  "icon-state-degradado": { name: "Degradado", alt: "Ícone de estado Degradado" },
};

// Banned third-party IP / English lore terms (06-terminologia-e-ip.md),
// mirrored from the guard list in scripts/check-terminologia.mjs. Whole-word
// match: PT words that merely contain a banned substring do not false-flag.
// Terms that would trip the guard themselves are split into string
// concatenations, keeping the assembled term out of the source scan.
const BANNED_TERMS = [
  "cyberpunk",
  "sandevistan",
  "gorilla" + " arms",
  "mantis blades",
  "kir" + "oshi",
  "max" + "tac",
  "trauma team",
  "blackwall",
  "braindance",
  "ch" + "oom",
  "edger" + "unners?",
  "night city",
  "night city" + " leg" + "ends?",
  "silverhand",
  "afterlife",
  "johnny silverhand",
  "monowire",
  "berserk",
  "street" + " cred",
  "ripper" + "doc",
  "eddies",
  "cyberdeck",
  "berserker",
  "netrunner",
  "solos?",
  "techs?",
  "fixers?",
  "nomads?",
  "med" + "techs?",
  "gig" + "s?",
  "crews?",
  "fight\\s*pits?",
  "drone\\s*races?",
  "data[- ]trading",
  "corporate\\s*roulette",
  "chrome",
  "underground",
  "flatline",
  "stim" + "s?",
  "syn[- ]?caf[eé]",
  "adrenastim",
  "black\\s*[- ]?lace",
  "glitter",
  "reflex",
  "ghost",
  "ice",
  "black\\s*ice",
  "icebreaker",
  "deep\\s*net",
  "deep\\s*dive",
  "burnout",
  "blackout",
  "neural" + " booster",
  "reflex" + "\\s+tuner",
  "subdermal" + " armor",
  "street" + " level",
  "run" + "ners?",
  "leg" + "ends?",
  "unknown",
  "loot",
  "access[- ]?chip",
];
const bannedRegex = new RegExp(
  `\\b(?:${BANNED_TERMS.join("|")})\\b|\\bCortex\\+`,
  "i",
);

const ROOT_ATTRS = [
  'xmlns="http://www.w3.org/2000/svg"',
  'viewBox="0 0 24 24"',
  'fill="none"',
  'stroke="currentColor"',
  'stroke-width="1.5"',
  'stroke-linecap="round"',
  'stroke-linejoin="round"',
];

const FORBIDDEN_TOKENS = [
  "<text",
  "<tspan",
  "<title",
  "<desc",
  "<foreignobject",
  "<image",
  "<defs",
  "<lineargradient",
  "<filter",
  "<mask",
  "<clippath",
  "<style",
  "<script",
  "href",
  "xlink:href",
  "font-",
];
const ON_ATTR = /on[a-z]+\s*=/i;

// Numbers in a path `d` string that are actual coordinates. The only
// non-coordinate numbers in path data are the two flags of an arc (A/a)
// command (large-arc-flag and sweep-flag, always 0/1) — those are skipped.
function dCoordinates(d: string): number[] {
  const tokens = d.match(/[a-zA-Z]|[-+]?\d*\.?\d+/g) ?? [];
  const coords: number[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) {
      if (t.toUpperCase() === "A") {
        i++;
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          // one 7-param arc group: rx ry x-axis-rotation large-arc-flag
          // sweep-flag x y. Position 2 is a rotation angle (degrees, may be
          // 0), positions 3-4 are 0/1 flags — none are grid coordinates.
          for (let k = 0; k < 7 && i < tokens.length; k++, i++) {
            if (k !== 2 && k !== 3 && k !== 4) coords.push(Number(tokens[i]));
          }
        }
        continue;
      }
      i++;
      continue;
    }
    coords.push(Number(tokens[i]));
    i++;
  }
  return coords;
}

// Integer attrs of a single tag (e.g. cx, cy, r, x1, y1, width...).
function integerAttrs(tag: string): Record<string, number> {
  const attrs: Record<string, number> = {};
  for (const m of tag.matchAll(/([a-z0-9]+)="(-?\d+)"/gi)) {
    attrs[m[1].toLowerCase()] = Number(m[2]);
  }
  return attrs;
}

describe("icon SVGs: style guide", () => {
  it("should ship exactly 35 files named icon-{cat}-<slug>.svg", () => {
    const NAME_RE = /^icon-(attr|role|action|res|frame|tier|state)-[a-z0-9-]+\.svg$/;
    expect(svgFiles).toHaveLength(35);
    for (const f of svgFiles) {
      expect(f, f).toMatch(NAME_RE);
    }
  });

  it.each(svgFiles)("should declare the canonical root attributes (%s)", (file) => {
    const svg = readSvg(file);
    for (const attr of ROOT_ATTRS) {
      expect(svg, `${file} missing ${attr}`).toContain(attr);
    }
  });

  it.each(svgFiles)("should be stroke-only: no text, defs, hrefs, handlers or scripts (%s)", (file) => {
    const svg = readSvg(file).toLowerCase();
    for (const token of FORBIDDEN_TOKENS) {
      expect(svg, `${file} contains ${token}`).not.toContain(token);
    }
    expect(readSvg(file)).not.toMatch(ON_ATTR);
  });

  it.each(svgFiles)("should use currentColor only, no hardcoded HEX colors (%s)", (file) => {
    const svg = readSvg(file);
    expect(svg, `${file} contains a HEX color`).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(svg, `${file} contains a named color`).not.toMatch(/\b(?:red|blue|green|white|black|gray|grey|yellow|orange|purple|cyan|magenta|gold)\b/i);
  });

  it.each(svgFiles)("should contain 1–3 shape elements (%s)", (file) => {
    const svg = readSvg(file);
    const count = (svg.match(/<(path|circle|rect|line|polygon|polyline|ellipse)\b/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(3);
  });

  it.each(svgFiles)("should keep every file under 4096 bytes (%s)", (file) => {
    const bytes = Buffer.byteLength(readSvg(file), "utf8");
    expect(bytes).toBeLessThanOrEqual(4096);
  });

  it.each(svgFiles)("should use only integer path coordinates inside the [2,22] grid (%s)", (file) => {
    const svg = readSvg(file);
    const violations: string[] = [];
    for (const m of svg.matchAll(/<path\b[^>]*\bd="([^"]*)"/g)) {
      for (const n of dCoordinates(m[1])) {
        if (!Number.isInteger(n)) violations.push(`non-integer coordinate ${n}`);
        else if (n < 2 || n > 22) violations.push(`coordinate ${n} outside [2,22]`);
      }
    }
    expect(violations).toEqual([]);
  });

  it.each(svgFiles)("should keep circle/rect/line geometry inside the padded grid (%s)", (file) => {
    const svg = readSvg(file);
    const violations: string[] = [];
    for (const tag of svg.match(/<circle\b[^>]*>/g) ?? []) {
      const { cx, cy, r } = integerAttrs(tag);
      if (cx === undefined || cy === undefined || r === undefined) {
        violations.push("circle missing cx/cy/r");
        continue;
      }
      if (cx - r < 2 || cx + r > 22 || cy - r < 2 || cy + r > 22) {
        violations.push(`circle (${cx},${cy}) r=${r} escapes [2,22]`);
      }
    }
    for (const tag of svg.match(/<rect\b[^>]*>/g) ?? []) {
      const { x, y, width, height } = integerAttrs(tag);
      if (x === undefined || y === undefined || width === undefined || height === undefined) {
        violations.push("rect missing x/y/width/height");
        continue;
      }
      if (x < 2 || y < 2 || x + width > 22 || y + height > 22) {
        violations.push(`rect (${x},${y}) ${width}x${height} escapes [2,22]`);
      }
    }
    for (const tag of svg.match(/<line\b[^>]*>/g) ?? []) {
      for (const [k, v] of Object.entries(integerAttrs(tag))) {
        if (v < 2 || v > 22) violations.push(`line ${k}=${v} outside [2,22]`);
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("asset manifest", () => {
  it('should declare version "0.2.0" with exactly 35 assets and 35 files', () => {
    expect(manifest.version).toBe("0.2.0");
    expect(manifest.assets).toHaveLength(35);
    expect(svgFiles).toHaveLength(35);
  });

  it("should have unique ids matching the file basename", () => {
    const ids = manifest.assets.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of manifest.assets) {
      expect(a.id).toBe(a.file.split("/").pop()?.replace(/\.svg$/, ""));
    }
  });

  it("should have no orphans: every entry has a file and every file has an entry", () => {
    const diskIds = new Set(svgFiles.map((f) => f.replace(/\.svg$/, "")));
    for (const a of manifest.assets) {
      expect(diskIds.has(a.id), `manifest entry ${a.id} has no file`).toBe(true);
    }
    for (const id of diskIds) {
      expect(
        manifest.assets.some((a) => a.id === id),
        `file ${id}.svg has no manifest entry`,
      ).toBe(true);
    }
  });

  it("should point file at the canonical asset path", () => {
    for (const a of manifest.assets) {
      expect(a.file).toBe(`app/src/assets/icons/${a.id}.svg`);
    }
  });

  it("should have non-empty curated fields for every asset", () => {
    for (const a of manifest.assets) {
      expect(a.name.trim(), a.id).not.toBe("");
      expect(a.description.trim(), a.id).not.toBe("");
      expect(a.alt.trim(), a.id).not.toBe("");
      expect(a.usage.trim(), a.id).not.toBe("");
      expect(a.category, a.id).not.toBe("");
      expect(a.colorToken, a.id).not.toBe("");
    }
  });

  it("should match the canonical id → name/alt map", () => {
    for (const a of manifest.assets) {
      const expected = CANONICAL[a.id];
      expect(expected, `no canonical entry for ${a.id}`).toBeDefined();
      expect(a.name, a.id).toBe(expected!.name);
      expect(a.alt, a.id).toBe(expected!.alt);
    }
  });

  it("should use only allowed colorTokens", () => {
    const ALLOWED = new Set([
      "nd-cyan",
      "nd-magenta",
      "nd-gold",
      "nd-purple",
      "nd-green",
      "nd-text",
      "nd-text-secondary",
    ]);
    for (const a of manifest.assets) {
      expect(ALLOWED.has(a.colorToken), `${a.id}: ${a.colorToken}`).toBe(true);
    }
  });

  it("should match the expected per-category counts", () => {
    const counts = new Map<string, number>();
    for (const a of manifest.assets) {
      counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({
      "icones-atributos": 5,
      "icones-roles": 5,
      "icones-acoes": 5,
      "icones-recursos": 6,
      "molduras-cards": 4,
      "badges-tier": 5,
      "indicadores-estado": 5,
    });
  });
});

describe("IP curation", () => {
  it("should not contain banned terms in any curated field (name/alt/description/usage)", () => {
    for (const a of manifest.assets) {
      const text = `${a.name} ${a.alt} ${a.description} ${a.usage}`;
      expect(text, a.id).not.toMatch(bannedRegex);
    }
  });

  it.each(svgFiles)("should not contain banned terms inside the SVG (%s)", (file) => {
    expect(readSvg(file)).not.toMatch(bannedRegex);
  });
});
