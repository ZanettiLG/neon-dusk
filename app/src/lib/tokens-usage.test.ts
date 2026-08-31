/**
 * Token usage guards (issue #53) — keep the core UI honest against the
 * canonical tokens (app/src/lib/tokens.ts):
 *
 *  1. Every `nd-*` / `neon-*` class used in core (components/**, App.tsx,
 *     style.css) must resolve to a token key — FAIL.
 *  2. Zero hardcoded values in core: hex literals, rgb()/rgba(), text-[Npx],
 *     min-h/min-w-[44px], z-N, duration-N and arbitrary sizes — FAIL, with
 *     the documented allowlist (max-w-[240px] ChromeBodyMapSvg,
 *     max-w-[85vw] Drawer).
 *  3. views/** get the same scan but warn-only (epic #14 follow-up) — WARN.
 *  4. Tokens with no class usage in core warn — WARN (drift signal).
 *
 * Hex note: issue references like "#140" are digits-only and never match the
 * scan regex (real palette literals always contain letters, e.g. #0a0a0a).
 * CSS custom properties (`--nd-*`) are skipped so var() references in
 * style.css don't false-positive.
 */
import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tokens } from "@/lib/tokens";

const srcDir = join(process.cwd(), "src");

/** Recursive walk of .ts/.tsx files, excluding test files. */
function walkSource(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      out.push(...walkSource(p));
    } else if (/\.(tsx|ts)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      out.push(p);
    }
  }
  return out;
}

const CORE_DIRS = [join(srcDir, "components")];
const CORE_FILES = [
  ...CORE_DIRS.flatMap(walkSource),
  join(srcDir, "App.tsx"),
  join(srcDir, "style.css"),
];
const VIEW_FILES = walkSource(join(srcDir, "views"));

const coreContent = CORE_FILES.map((f) => readFileSync(f, "utf8")).join("\n");

/**
 * Strip comments (block, multi-line and line) from a file's lines so issue
 * references ("#140") and prose ("Neon Dusk") never count as literals.
 */
function stripComments(lines: string[]): string[] {
  let inBlock = false;
  return lines.map((line) => {
    let code = line;
    if (inBlock) {
      const end = code.indexOf("*/");
      if (end === -1) return "";
      code = code.slice(end + 2);
      inBlock = false;
    }
    for (;;) {
      const start = code.indexOf("/*");
      if (start === -1) break;
      const end = code.indexOf("*/", start + 2);
      if (end === -1) {
        code = code.slice(0, start);
        inBlock = true;
        break;
      }
      code = code.slice(0, start) + code.slice(end + 2);
    }
    const lineComment = code.indexOf("//");
    if (lineComment !== -1) code = code.slice(0, lineComment);
    return code;
  });
}

/** Token keys that can appear as `nd-*` / `neon-*` class fragments. */
const PREFIXED_TOKEN_KEYS = new Set<string>([
  ...Object.keys(tokens.colors),
  ...Object.keys(tokens.boxShadow),
  ...Object.keys(tokens.transitionDuration),
  ...Object.keys(tokens.fontSize),
  ...Object.keys(tokens.zIndex),
]);

/**
 * Non-class identifiers that legitimately carry the `nd-`/`neon-` prefix
 * (documented): localStorage keys, package scopes, internal constants.
 */
const TOKEN_ALLOWLIST = new Set<string>(["nd-pwa-install-dismissed", "neon-dusk"]);

/**
 * Extract `nd-*`/`neon-*` tokens from a code line, skipping:
 * - CSS custom properties (`--nd-*`);
 * - substrings inside identifiers (background-image, end-events);
 * - package scopes (`@neon-dusk/shared`).
 */
function extractTokenClasses(line: string): string[] {
  const out: string[] = [];
  const re = /nd-[a-z0-9-]+|neon-[a-z0-9-]+/g;
  for (const m of line.matchAll(re)) {
    const before = m.index > 0 ? line[m.index - 1] : "";
    if (before !== "" && /[\w@]/.test(before)) continue;
    if (m.index >= 2 && line.slice(m.index - 2, m.index) === "--") continue;
    out.push(m[0]);
  }
  return out;
}

/** Tailwind defaults that must NOT be treated as token-driven utilities. */
const TAILWIND_DEFAULTS: Record<string, Set<string>> = {
  fontFamily: new Set([
    "sans",
    "serif",
    "mono",
    "bold",
    "normal",
    "medium",
    "semibold",
    "light",
    "thin",
    "extralight",
    "black",
    "extrabold",
    "italic",
  ]),
  borderRadius: new Set(["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"]),
  minHeight: new Set(["screen", "full", "0", "fit", "min", "max", "svh", "lvh", "dvh"]),
  minWidth: new Set(["0", "full", "fit", "min", "max"]),
  animation: new Set(["none", "spin", "ping", "pulse", "bounce"]),
};

/** Resolve a non-prefixed token-driven utility to { category, key } or null. */
function resolveTokenUtility(cls: string): { category: string; key: string } | null {
  if (cls.startsWith("font-")) return { category: "fontFamily", key: cls.slice(5) };
  if (cls.startsWith("rounded-")) return { category: "borderRadius", key: cls.slice(8) };
  if (cls.startsWith("min-h-")) return { category: "minHeight", key: cls.slice(6) };
  if (cls.startsWith("min-w-")) return { category: "minWidth", key: cls.slice(6) };
  if (cls.startsWith("animate-")) return { category: "animation", key: cls.slice(8) };
  return null;
}

const TOKEN_CATEGORIES: Record<string, Record<string, unknown>> = {
  fontFamily: tokens.fontFamily,
  borderRadius: tokens.borderRadius,
  minHeight: tokens.minHeight,
  minWidth: tokens.minWidth,
  animation: tokens.animation,
};

/** Hardcode patterns banned in core (allowlist below for documented cases). */
const HARDCODE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /#[0-9a-fA-F]{3,8}\b/, label: "hex literal" },
  { re: /rgba?\(/, label: "rgb()/rgba()" },
  { re: /text-\[\d+(?:\.\d+)?px\]/, label: "text-[Npx]" },
  { re: /min-[hw]-\[44px\]/, label: "min-h/min-w-[44px]" },
  { re: /z-\d+/, label: "z-N" },
  { re: /duration-\d+/, label: "duration-N" },
  { re: /-\[[0-9.]+(?:px|vw|rem|em|%)+\]/, label: "arbitrary value" },
];

/** Documented exceptions (issue #53): keep these out of the hardcode scan. */
const HARDCODE_ALLOWLIST: Array<{ file: string; re: RegExp }> = [
  { file: "ChromeBodyMapSvg.tsx", re: /max-w-\[240px\]/ },
  { file: "Drawer.tsx", re: /max-w-\[85vw\]/ },
];

interface Violation {
  file: string;
  line: number;
  label: string;
  detail: string;
}

/** Run the full scan (token resolution + hardcodes) over a file list. */
function scanFiles(files: string[]): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    const rawLines = readFileSync(file, "utf8").split(/\r?\n/);
    const lines = stripComments(rawLines);
    const basename = file.split(/[\\/]/).pop() ?? file;
    lines.forEach((line, i) => {
      // (1) nd-*/neon-* must resolve to a token.
      for (const token of extractTokenClasses(line)) {
        if (!PREFIXED_TOKEN_KEYS.has(token) && !TOKEN_ALLOWLIST.has(token)) {
          violations.push({
            file: basename,
            line: i + 1,
            label: "token desconhecido",
            detail: token,
          });
        }
      }
      // Bonus: token-driven utilities (font-*, rounded-*, min-h-touch, animate-*).
      const utilRe = /(?:font-|rounded-|min-h-|min-w-|animate-)[a-z0-9-]+/g;
      for (const m of line.matchAll(utilRe)) {
        const cls = m[0];
        const resolved = resolveTokenUtility(cls);
        if (!resolved) continue;
        const defaults = TAILWIND_DEFAULTS[resolved.category];
        if (defaults?.has(resolved.key)) continue;
        if (!(resolved.key in TOKEN_CATEGORIES[resolved.category])) {
          violations.push({ file: basename, line: i + 1, label: "utility sem token", detail: cls });
        }
      }
      // (2) hardcodes (allowlisted per-file).
      for (const { re, label } of HARDCODE_PATTERNS) {
        const m = line.match(re);
        if (!m) continue;
        const allowed = HARDCODE_ALLOWLIST.some((a) => a.file === basename && a.re.test(line));
        if (allowed) continue;
        violations.push({ file: basename, line: i + 1, label, detail: m[0] });
      }
    });
  }
  return violations;
}

describe("core token usage (components/**, App.tsx, style.css)", () => {
  const violations = scanFiles(CORE_FILES);

  it("should resolve every used nd-*/neon-* class to a token", () => {
    const bad = violations.filter((v) => v.label === "token desconhecido");
    expect(
      bad.map((v) => `${v.file}:${v.line}:${v.detail}`),
      "classes sem token no core",
    ).toEqual([]);
  });

  it("should resolve every token-driven utility to a token", () => {
    const bad = violations.filter((v) => v.label === "utility sem token");
    expect(
      bad.map((v) => `${v.file}:${v.line}:${v.detail}`),
      "utilities sem token no core",
    ).toEqual([]);
  });

  it("should have zero hardcoded values in core", () => {
    const bad = violations.filter(
      (v) => v.label !== "token desconhecido" && v.label !== "utility sem token",
    );
    expect(
      bad.map((v) => `${v.file}:${v.line}:${v.label} ${v.detail}`),
      "hardcodes no core",
    ).toEqual([]);
  });
});

describe("view usage (warn-only, epic #14 follow-up)", () => {
  it("should not fail on view violations, only warn", () => {
    const violations = scanFiles(VIEW_FILES);
    if (violations.length > 0) {
      console.warn(
        `⚠ ${violations.length} violações em views/** (migração é follow-up do epic #14):`,
      );
      for (const v of violations) {
        console.warn(`  ${v.file}:${v.line}:${v.label} ${v.detail}`);
      }
    }
    expect(true).toBe(true);
  });
});

describe("unused tokens (warn)", () => {
  it("should warn when a token has no class usage in core", () => {
    const probes: Array<[string, string[]]> = [
      ["colors", Object.keys(tokens.colors)],
      ["boxShadow", Object.keys(tokens.boxShadow)],
      ["transitionDuration", Object.keys(tokens.transitionDuration)],
      ["fontSize", Object.keys(tokens.fontSize)],
      ["zIndex", Object.keys(tokens.zIndex)],
      ["fontFamily", Object.keys(tokens.fontFamily).map((k) => `font-${k}`)],
      ["borderRadius", Object.keys(tokens.borderRadius).map((k) => `rounded-${k}`)],
      ["minHeight", Object.keys(tokens.minHeight).map((k) => `min-h-${k}`)],
      ["minWidth", Object.keys(tokens.minWidth).map((k) => `min-w-${k}`)],
      ["animation", Object.keys(tokens.animation).map((k) => `animate-${k}`)],
      ["screens", Object.keys(tokens.screens).map((k) => `${k}:`)],
      ["effects", ["--nd-scanline"]],
    ];
    const unused: string[] = [];
    for (const [category, classProbes] of probes) {
      for (const probe of classProbes) {
        if (!coreContent.includes(probe)) unused.push(`${category}.${probe}`);
      }
    }
    if (unused.length > 0) {
      console.warn(`⚠ ${unused.length} tokens sem uso no core (sinal de drift para o epic #14):`);
      console.warn(`  ${unused.join(", ")}`);
    }
    expect(true).toBe(true);
  });
});

describe("scanner helpers (synthetic inputs)", () => {
  it("should strip block, multi-line and line comments before scanning", () => {
    const lines = [
      "const a = '#0a0a0a'; // issue #140 — digits-only, never a literal",
      "/* #ff2020 in a block comment */ const b = 1;",
      "const c = 2; /* multi-line",
      "still comment #d4a017 */ const d = 3;",
    ];
    const stripped = stripComments(lines);
    expect(stripped[0]).toBe("const a = '#0a0a0a'; ");
    expect(stripped[1]).toBe(" const b = 1;");
    expect(stripped[2]).toBe("const c = 2; ");
    expect(stripped[3]).toBe(" const d = 3;");
  });

  it("should extract nd-*/neon-* classes but skip CSS vars, identifiers and scopes", () => {
    expect(extractTokenClasses("bg-nd-cyan/20 shadow-neon-cyan")).toEqual(["nd-cyan", "neon-cyan"]);
    expect(extractTokenClasses("text-nd-text-secondary")).toEqual(["nd-text-secondary"]);
    expect(extractTokenClasses("--nd-focus-color: inherit;")).toEqual([]);
    expect(extractTokenClasses("background-image: none;")).toEqual([]);
    expect(extractTokenClasses("import { x } from '@neon-dusk/shared';")).toEqual([]);
  });

  it("should resolve token-driven utilities and reject non-token ones", () => {
    expect(resolveTokenUtility("font-heading")).toEqual({ category: "fontFamily", key: "heading" });
    expect(resolveTokenUtility("rounded-pill")).toEqual({ category: "borderRadius", key: "pill" });
    expect(resolveTokenUtility("min-h-touch")).toEqual({ category: "minHeight", key: "touch" });
    expect(resolveTokenUtility("min-w-touch")).toEqual({ category: "minWidth", key: "touch" });
    expect(resolveTokenUtility("animate-pulse-neon")).toEqual({
      category: "animation",
      key: "pulse-neon",
    });
    expect(resolveTokenUtility("bg-nd-cyan")).toBeNull();
    expect(resolveTokenUtility("text-sm")).toBeNull();
  });
});

describe("scanFiles (synthetic files)", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "nd-tokens-scan-"));
  const write = (name: string, content: string): string => {
    const p = join(sandbox, name);
    writeFileSync(p, content, "utf8");
    return p;
  };

  afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("should ignore hex literals and nd-* refs inside comments", () => {
    const file = write(
      "Commented.tsx",
      "// issue #140 — digits-only\n/* #0a0a0a is a palette literal in prose */\nconst x = 1;\n",
    );
    expect(scanFiles([file])).toEqual([]);
  });

  it("should not flag CSS custom properties or package scopes", () => {
    const file = write(
      "Vars.tsx",
      "--nd-focus-color: inherit;\nimport { x } from '@neon-dusk/shared';\n",
    );
    expect(scanFiles([file])).toEqual([]);
  });

  it("should flag unknown nd-* classes and hardcoded values", () => {
    const file = write("Bad.tsx", 'className="bg-nd-nonexistent text-[10px] z-50"\n');
    const labels = scanFiles([file]).map((v) => v.label);
    expect(labels).toContain("token desconhecido");
    expect(labels).toContain("text-[Npx]");
    expect(labels).toContain("z-N");
  });

  it("should flag every banned hardcode pattern (duration, hex, rgb, min-h, arbitrary)", () => {
    const file = write(
      "Hardcodes.tsx",
      [
        "style={{ background: '#ff2020' }}",
        "style={{ color: 'rgba(255, 32, 32, 0.25)' }}",
        'className="duration-500"',
        'className="min-h-[44px] min-w-[44px]"',
        'className="w-[240px]"',
      ].join("\n") + "\n",
    );
    const labels = scanFiles([file]).map((v) => v.label);
    expect(labels).toContain("hex literal");
    expect(labels).toContain("rgb()/rgba()");
    expect(labels).toContain("duration-N");
    expect(labels).toContain("min-h/min-w-[44px]");
    expect(labels).toContain("arbitrary value");
  });

  it("should honor the per-file hardcode allowlist", () => {
    const file = write("ChromeBodyMapSvg.tsx", 'className="w-full max-w-[240px] mx-auto"\n');
    expect(scanFiles([file])).toEqual([]);
  });
});
