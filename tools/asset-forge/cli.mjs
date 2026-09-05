#!/usr/bin/env node
/* global Buffer, console, process */
/* eslint-disable no-console -- a CLI imprime no stdout/stderr */
/**
 * asset-forge — AI asset generation CLI for Neon Dusk (SD1.5 via ComfyUI).
 *
 *   node cli.mjs generate <tipo> [--variants N] [--seed S] [--out DIR]
 *                           [--url URL] [--timeout S] [--checkpoint NAME]
 *                           [--subject TXT] [--family ID] [--member ID]
 *                           [--district ID] [--dry-run]
 *   node cli.mjs list
 *   node cli.mjs check [--url URL]
 *
 * Exit codes: 0 ok · 1 unexpected · 2 usage/registry · 3 ComfyUI offline
 *             4 generation failed · 5 timeout. Env: COMFYUI_URL.
 * Family mode (--family/--member): seeds are deterministic per member
 * (familySeed), files are named <member>.png, and per-member failures are
 * collected — the CLI exits with the worst failure code after the batch.
 */

import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRegistry } from "./src/registry.mjs";
import { buildPrompt } from "./src/prompts.mjs";
import { buildWorkflow, CHECKPOINT } from "./src/workflow.mjs";
import { familySeed } from "./src/seeds.mjs";
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
  asset-forge generate <tipo> [--variants N] [--seed S] [--out DIR] [--url URL] [--timeout S] [--checkpoint NOME]
                        [--subject TEXTO] [--family ID] [--member ID] [--district ID] [--dry-run]
  asset-forge list
  asset-forge check [--url URL] [--checkpoint NOME]

Tipos e famílias: veja "list".`;

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
        subject: { type: "string" },
        family: { type: "string" },
        member: { type: "string" },
        district: { type: "string" },
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
    subject: parsed.values.subject,
    family: parsed.values.family,
    member: parsed.values.member,
    district: parsed.values.district,
    dryRun: parsed.values["dry-run"],
  };
}

/** `list` — print registry types, seed families and districts without touching the network. */
async function cmdList() {
  const registry = await loadRegistry();
  console.log("Tipos do registry:");
  for (const type of registry.types) {
    const canonical = type.output.filename ? ` → ${type.output.filename}` : " (sem integração)";
    console.log(
      `  ${type.id.padEnd(12)} ${type.regime.padEnd(11)} ${type.size.width}×${type.size.height}  ${type.output.dir}/${canonical}`,
    );
  }
  console.log("\nFamílias (seedFamilies):");
  for (const family of registry.seedFamilies) {
    console.log(
      `  ${family.id.padEnd(22)} ${family.type.padEnd(10)} ${family.members.length} members`,
    );
  }
  console.log("\nDistritos:");
  for (const district of registry.districts) {
    console.log(`  ${district.id.padEnd(12)} ${district.name}`);
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
 *
 * Plain mode: each variant is a distinct seed; files are named <id>-<seed>.png
 * so the accepted variant can be renamed to the canonical filename (registry).
 *
 * Family mode (--family/--member): deterministic familySeed per member, files
 * named <member>.png in the type's output dir. Server/checkpoint are checked
 * once; per-member failures (HTTP/generation/timeout) are collected and the
 * batch continues, exiting with the worst failure code. A server going down
 * mid-batch aborts everything (exit 3).
 */
async function cmdGenerate({
  positional,
  url,
  variants,
  seed,
  out,
  timeoutMs,
  checkpoint,
  dryRun,
  subject,
  family: familyId,
  member,
  district: districtId,
}) {
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

  // ---- usage validation: everything that can be wrong aborts here, before
  // any network call or file write.
  if (subject !== undefined && subject.trim().length === 0) {
    throw new UsageError("--subject não pode ser vazio.");
  }
  if (member !== undefined && familyId === undefined) {
    throw new UsageError("--member exige --family (members pertencem a uma família).");
  }
  let family = null;
  if (familyId !== undefined) {
    if (seed !== undefined || variants !== 1) {
      throw new UsageError(
        "--seed e --variants não combinam com --family/--member: seeds de família são determinísticas (familySeed).",
      );
    }
    family = registry.seedFamilies.find((f) => f.id === familyId);
    if (!family) {
      const known = registry.seedFamilies.map((f) => f.id).join(", ");
      throw new UsageError(`Família desconhecida: "${familyId}". Famílias válidas: ${known}.`);
    }
    if (family.type !== type.id) {
      throw new UsageError(
        `Família "${family.id}" gera assets do tipo "${family.type}" — incompatível com "${type.id}".`,
      );
    }
    if (member !== undefined && !family.members.includes(member)) {
      const known = family.members.join(", ");
      throw new UsageError(
        `Member "${member}" não pertence à família "${family.id}". Members válidos: ${known}.`,
      );
    }
  }
  let district = null;
  if (districtId !== undefined) {
    district = registry.districts.find((d) => d.id === districtId);
    if (!district) {
      const known = registry.districts.map((d) => d.id).join(", ");
      throw new UsageError(`Distrito desconhecido: "${districtId}". Distritos válidos: ${known}.`);
    }
    if (type.regime !== "atmospheric") {
      throw new UsageError(
        `distrito só para regime atmospheric — o tipo "${type.id}" é flat e não tem contexto distrital.`,
      );
    }
  }

  // ---- family/member mode: deterministic batch ------------------------------
  if (family) {
    // Explicit --district wins; otherwise a member id that names a district
    // (cenas-distritos) inherits that district's accent fragment.
    const districtFor = (memberId) =>
      district ?? registry.districts.find((d) => d.id === memberId) ?? null;
    const members = member !== undefined ? [member] : family.members;
    const plan = members.map((memberId) => ({
      memberId,
      memberSeed: familySeed(family.id, memberId),
      memberDistrict: districtFor(memberId),
    }));

    if (dryRun) {
      console.log(`[dry-run] família ${family.id} (${plan.length} members):`);
      for (const { memberId, memberSeed } of plan)
        console.log(`  ${memberId} → seed ${memberSeed}`);
      const first = plan[0];
      const prompts = buildPrompt(type, registry, { subject, district: first.memberDistrict });
      console.log(
        JSON.stringify(
          buildWorkflow(type, prompts, first.memberSeed, ckpt, first.memberId),
          null,
          2,
        ),
      );
      return;
    }

    await checkServer(url);
    await checkCheckpoint(url, ckpt);
    // Resolve the registry dir against the repo root (two levels above this
    // tool), so the default output location is stable regardless of caller CWD.
    // An explicit --out stays CWD-relative on purpose.
    const outDir = out ?? path.resolve(import.meta.dirname, "..", "..", type.output.dir);
    const displayDir = out ?? type.output.dir;
    await mkdir(outDir, { recursive: true });

    const failures = [];
    for (const [index, { memberId, memberSeed, memberDistrict }] of plan.entries()) {
      const started = Date.now();
      try {
        const prompts = buildPrompt(type, registry, { subject, district: memberDistrict });
        const promptId = await submitWorkflow(
          url,
          buildWorkflow(type, prompts, memberSeed, ckpt, memberId),
        );
        const image = await pollHistory(url, promptId, { timeoutMs });
        const bytes = await downloadImage(url, image);
        await writeFile(path.join(outDir, `${memberId}.png`), Buffer.from(bytes));
        console.log(
          `  [${index + 1}/${plan.length}] ${memberId} → ${displayDir}/${memberId}.png` +
            ` (seed ${memberSeed}, ${type.size.width}×${type.size.height}, ${((Date.now() - started) / 1000).toFixed(1)}s)`,
        );
      } catch (err) {
        if (err instanceof ComfyOfflineError) throw err; // server gone — abort the whole batch (exit 3)
        if (!(
          err instanceof HttpError ||
          err instanceof GenerationError ||
          err instanceof TimeoutError
        )) {
          throw err; // unexpected bug — surface it (exit 1)
        }
        failures.push({ memberId, err });
      }
    }

    const ok = plan.length - failures.length;
    const failed = failures.length
      ? ` · falhou: ${failures.map(({ memberId, err }) => `${memberId} (${err.message})`).join(", ")}`
      : "";
    if (failures.length > 0) {
      console.error(`✓ ${ok}/${plan.length} gerados${failed}`);
      // Worst failure wins: timeout (5) outranks generation failure (4).
      return Math.max(
        ...failures.map(({ err }) =>
          err instanceof TimeoutError ? EXIT.TIMEOUT : EXIT.GENERATION,
        ),
      );
    }
    console.log(`✓ ${ok}/${plan.length} gerados`);
    return EXIT.OK;
  }

  // ---- plain mode: single prompt, N variants (unchanged behavior) -----------
  const prompts = buildPrompt(type, registry, { subject, district });
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
      // generate returns its exit code (batch mode collects per-member failures)
      return cmdGenerate(args);
    case "list":
      await cmdList();
      return undefined;
    case "check":
      await cmdCheck(args);
      return undefined;
    default:
      throw new UsageError(`Comando "${args.command ?? "(vazio)"}" desconhecido.\n\n${USAGE}`);
  }
}

try {
  const code = await main(process.argv.slice(2));
  process.exitCode = code ?? EXIT.OK;
} catch (err) {
  const { message, code, stack } = errorExit(err);
  console.error(message);
  if (stack) console.error(stack); // unexpected bug — keep the trace for debugging
  process.exitCode = code;
}
