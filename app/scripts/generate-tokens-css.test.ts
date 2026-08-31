/**
 * Generator script contract (issue #53) — app/scripts/generate-tokens-css.mjs
 * is the CI/prebuild entry point that materializes app/src/tokens.css from the
 * canonical tokens. The script must:
 *
 *  1. Exit 0 and write a deterministic file (idempotent — byte-for-byte equal
 *     to buildTokensCss(tokens), the same contract tokens-css.test.ts pins).
 *  2. Exit non-zero with a clear message on any failure (missing source file,
 *     invalid import) — CI and `prebuild` depend on that contract.
 *
 * Runs in a temp sandbox (copied script + self-contained jiti + real token
 * sources) so the committed app/src/tokens.css is never touched.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createRequire } from "node:module";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { tokens } from "@/lib/tokens";
import { buildTokensCss } from "@/lib/tokens-css";

const require = createRequire(import.meta.url);
const jitiDir = dirname(require.resolve("jiti/package.json"));
const scriptSource = join(process.cwd(), "scripts", "generate-tokens-css.mjs");
const tokensSource = join(process.cwd(), "src", "lib", "tokens.ts");
const tokensCssSource = join(process.cwd(), "src", "lib", "tokens-css.ts");

const sandbox = mkdtempSync(join(tmpdir(), "nd-tokens-gen-"));

function runScript(): { status: number | null; stdout: string; stderr: string } {
  const res = spawnSync(process.execPath, ["scripts/generate-tokens-css.mjs"], {
    cwd: sandbox,
    encoding: "utf8",
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe("generate-tokens-css.mjs", () => {
  beforeAll(() => {
    mkdirSync(join(sandbox, "scripts"), { recursive: true });
    mkdirSync(join(sandbox, "src", "lib"), { recursive: true });
    mkdirSync(join(sandbox, "node_modules"), { recursive: true });
    cpSync(scriptSource, join(sandbox, "scripts", "generate-tokens-css.mjs"));
    cpSync(jitiDir, join(sandbox, "node_modules", "jiti"), { recursive: true });
  });

  beforeEach(() => {
    // Restore the canonical sources so each case starts from a clean sandbox.
    cpSync(tokensSource, join(sandbox, "src", "lib", "tokens.ts"));
    cpSync(tokensCssSource, join(sandbox, "src", "lib", "tokens-css.ts"));
  });

  afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("should exit 0 and write tokens.css matching buildTokensCss (idempotent)", () => {
    const { status, stderr } = runScript();
    expect(status).toBe(0);
    expect(stderr).toBe("");
    const written = readFileSync(join(sandbox, "src", "tokens.css"), "utf8");
    expect(written).toBe(buildTokensCss(tokens));
  });

  it("should exit non-zero when the canonical source is missing (ENOENT)", () => {
    rmSync(join(sandbox, "src", "lib", "tokens.ts"));
    const { status, stderr } = runScript();
    expect(status).not.toBe(0);
    expect(stderr).toContain("falha ao gerar tokens.css");
  });

  it("should exit non-zero when the canonical source fails to import", () => {
    writeFileSync(join(sandbox, "src", "lib", "tokens.ts"), "export const tokens = {", "utf8");
    const { status, stderr } = runScript();
    expect(status).not.toBe(0);
    expect(stderr).toContain("falha ao gerar tokens.css");
  });
});