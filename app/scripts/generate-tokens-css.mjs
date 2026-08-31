#!/usr/bin/env node
/* global console, process */
/* eslint-disable no-console -- CLI: output IS the contract (exit code + message). */
/**
 * Generates app/src/tokens.css from the canonical tokens (issue #53).
 *
 * Loads app/src/lib/tokens.ts and app/src/lib/tokens-css.ts through jiti
 * (the same loader Tailwind uses for tailwind.config.js) and writes the
 * committed CSS file. The output is deterministic — the test
 * app/src/lib/tokens-css.test.ts pins it byte-for-byte.
 *
 * Failures (missing file, permission, import error) exit non-zero with a
 * clear message — CI and `prebuild` depend on that contract.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..", "src");
const tokensPath = join(srcDir, "lib", "tokens.ts");
const tokensCssPath = join(srcDir, "lib", "tokens-css.ts");
const outPath = join(srcDir, "tokens.css");

try {
  const require = createRequire(import.meta.url);
  const jiti = require("jiti")(import.meta.url);

  const { tokens } = jiti(tokensPath);
  const { buildTokensCss } = jiti(tokensCssPath);

  const css = buildTokensCss(tokens);
  writeFileSync(outPath, css, "utf8");
  console.log(`✓ tokens.css atualizado (${css.length} bytes) → ${outPath}`);
} catch (err) {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`✗ falha ao gerar tokens.css: ${detail}`);
  console.error(
    "  Verifique se app/src/lib/tokens.ts e app/src/lib/tokens-css.ts existem," +
      " se o diretório app/src é gravável e se o jiti está instalado (npm install).",
  );
  process.exit(1);
}
