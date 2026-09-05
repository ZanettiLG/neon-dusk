#!/usr/bin/env node
/* global Buffer, console, process */
/* eslint-disable no-console -- a CLI imprime no stdout/stderr */
/**
 * asset-forge — AI asset generation CLI for Neon Dusk (SD1.5 via ComfyUI).
 *
 *   node cli.mjs generate <tipo> [--variants N] [--seed S] [--out DIR]
 *                           [--url URL] [--timeout S] [--checkpoint NAME]
 *                           [--dry-run]
 *   node cli.mjs list
 *   node cli.mjs check [--url URL]
 *
 * Exit codes: 0 ok · 1 unexpected · 2 usage/registry · 3 ComfyUI offline
 *             4 generation failed · 5 timeout. Env: COMFYUI_URL.
 */

import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRegistry } from "./src/registry.mjs";
import { buildPrompt } from "./src/prompts.mjs";
import { buildWorkflow, CHECKPOINT } from "./src/workflow.mjs";
import {
  checkServer,
  checkCheckpoint,
  submitWorkflow,
  pollHistory,
  downloadImage,
} from "./src/provider.mjs";
import {
  ComfyOfflineError,
  HttpError,
  GenerationError,
  TimeoutError,
  RegistryError,
  UsageError,
} from "./src/errors.mjs";

const DEFAULT_URL = "http://127.0.0.1:8188";
const EXIT = { OK: 0, GENERIC: 1, USAGE: 2, OFFLINE: 3, GENERATION: 4, TIMEOUT: 5 };

/** CLI usage text (also the message for UsageError). */
const USAGE = `Uso:
  asset-forge generate <tipo> [--variants N] [--seed S] [--out DIR] [--url URL] [--timeout S] [--checkpoint NOME] [--dry-run]
  asset-forge list
  asset-forge check [--url URL] [--checkpoint NOME]

Tipos: body-map, metro-map, icon, avatar (veja "list").`;

/** Parse argv into { command, positional, options }. @throws {UsageError} */
function parseArgv(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        variants: { type: "string", short: "n" },
        seed: { type: "string", short: "s" },
        out: { type: "string", short: "o" },
        url: { type: "string", short: "u" },
        timeout: { type: "string", short: "t" },
        checkpoint: { type: "string" },
        "dry-run": { type: "boolean", default: false },
      },
    });
  } catch (err) {
    throw new UsageError(`${err.message}\n\n${USAGE}`);
  }
  const [command, ...positional] = parsed.positionals;
  const intOption = (name) => {
    const raw = parsed.values[name];
    if (raw === undefined) return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      throw new UsageError(`--${name} deve ser um inteiro positivo (recebido: "${raw}")`);
    }
    return value;
  };
  return {
    command,
    positional,
    url: parsed.values.url ?? process.env.COMFYUI_URL ?? DEFAULT_URL,
    variants: intOption("variants") ?? 1,
    seed: intOption("seed"),
    out: parsed.values.out,
    timeoutMs: (intOption("timeout") ?? 120) * 1_000,
    checkpoint: parsed.values.checkpoint,
    dryRun: parsed.values["dry-run"],
  };
}

/** `list` — print registry types without touching the network. */
async function cmdList() {
  const registry = await loadRegistry();
  console.log("Tipos do registry:");
  for (const type of registry.types) {
    const canonical = type.output.filename ? ` → ${type.output.filename}` : " (sem integração)";
    console.log(
      `  ${type.id.padEnd(10)} ${type.size.width}×${type.size.height}  ${type.output.dir}/${canonical}`,
    );
  }
}

/** `check` — health check + checkpoint validation (default or --checkpoint). */
async function cmdCheck({ url, checkpoint }) {
  const ckpt = checkpoint ?? CHECKPOINT;
  await checkServer(url);
  await checkCheckpoint(url, ckpt);
  console.log(`✓ ComfyUI ok em ${url} — checkpoint "${ckpt}" presente`);
}

/**
 * `generate <tipo>` — build prompt, submit to ComfyUI, poll, download.
 * Each variant is a distinct seed; files are named <id>-<seed>.png so the
 * accepted variant can be renamed to the canonical filename (registry).
 */
async function cmdGenerate({ positional, url, variants, seed, out, timeoutMs, checkpoint, dryRun }) {
  if (positional.length !== 1) {
    throw new UsageError(`generate exige exatamente um tipo.\n\n${USAGE}`);
  }
  const registry = await loadRegistry();
  const type = registry.types.find((t) => t.id === positional[0]);
  if (!type) {
    const known = registry.types.map((t) => t.id).join(", ");
    throw new UsageError(`Tipo desconhecido: "${positional[0]}". Tipos válidos: ${known}.`);
  }

  const ckpt = checkpoint ?? CHECKPOINT;

  const prompts = buildPrompt(type, registry);
  if (dryRun) {
    console.log(`[dry-run] workflow de ${type.id} (seed ${seed ?? "aleatória na geração real"}):`);
    console.log(JSON.stringify(buildWorkflow(type, prompts, seed ?? 0, ckpt), null, 2));
    return;
  }

  await checkServer(url);
  await checkCheckpoint(url, ckpt);

  // Resolve the registry dir against the repo root (two levels above this tool),
  // so the default output location is stable regardless of caller CWD. An
  // explicit --out stays CWD-relative on purpose.
  const outDir = out ?? path.resolve(import.meta.dirname, "..", "..", type.output.dir);
  await mkdir(outDir, { recursive: true });
  const written = [];
  for (let i = 0; i < variants; i++) {
    const variantSeed = seed === undefined ? Math.floor(Math.random() * 2 ** 31) : seed + i;
    const started = Date.now();
    const promptId = await submitWorkflow(url, buildWorkflow(type, prompts, variantSeed, ckpt));
    const image = await pollHistory(url, promptId, { timeoutMs });
    const bytes = await downloadImage(url, image);
    const file = path.join(outDir, `${type.id}-${variantSeed}.png`);
    await writeFile(file, Buffer.from(bytes));
    written.push({ file, variantSeed, ms: Date.now() - started });
  }

  console.log(
    `✓ ${type.id}: ${written.length} ${written.length === 1 ? "variante gerada" : "variantes geradas"}`,
  );
  for (const { file, variantSeed, ms } of written) {
    console.log(
      `  ${file}  (seed ${variantSeed}, ${type.size.width}×${type.size.height}, ${(ms / 1000).toFixed(1)}s)`,
    );
  }
  if (type.output.filename) {
    console.log(
      `Aceite: renomeie a variante escolhida para ${type.output.filename} e commite (baselines/neon-dusk.md).`,
    );
  }
}

/** Map a thrown error to (message, exitCode) without stack noise. */
function errorExit(err) {
  if (err instanceof UsageError || err instanceof RegistryError) {
    return { message: `✗ ${err.message}`, code: EXIT.USAGE };
  }
  if (err instanceof ComfyOfflineError) {
    return {
      message: [
        `✗ ${err.message}`,
        "  Suba o servidor: comfyui --listen 127.0.0.1 (ou a URL do seu setup)",
        "  Ou aponte outra instância: --url http://host:porta  (env: COMFYUI_URL)",
      ].join("\n"),
      code: EXIT.OFFLINE,
    };
  }
  if (err instanceof TimeoutError) return { message: `✗ ${err.message}`, code: EXIT.TIMEOUT };
  if (err instanceof HttpError || err instanceof GenerationError) {
    return { message: `✗ Falha de geração — ${err.message}`, code: EXIT.GENERATION };
  }
  return { message: `✗ Erro inesperado: ${err.message}`, code: EXIT.GENERIC, stack: err.stack };
}

async function main(argv) {
  const args = parseArgv(argv);
  switch (args.command) {
    case "generate":
      await cmdGenerate(args);
      break;
    case "list":
      await cmdList();
      break;
    case "check":
      await cmdCheck(args);
      break;
    default:
      throw new UsageError(`Comando "${args.command ?? "(vazio)"}" desconhecido.\n\n${USAGE}`);
  }
}

try {
  await main(process.argv.slice(2));
  process.exitCode = EXIT.OK;
} catch (err) {
  const { message, code, stack } = errorExit(err);
  console.error(message);
  if (stack) console.error(stack); // unexpected bug — keep the trace for debugging
  process.exitCode = code;
}
