/* global URL */
import { readFile } from "node:fs/promises";
import { RegistryError } from "./errors.mjs";

const DEFAULT_REGISTRY_PATH = new URL("../registry.json", import.meta.url);

const VALID_SEED_POLICIES = new Set(["random", "fixed"]);

/**
 * Validate one asset-type entry from registry.json.
 * @param {unknown} raw parsed JSON value
 * @param {number} index position in the types array (for error messages)
 * @returns {object} the validated entry
 */
function validateType(raw, index) {
  const where = `types[${index}]`;
  if (typeof raw !== "object" || raw === null) {
    throw new RegistryError(`${where} deve ser um objeto`);
  }
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    throw new RegistryError(`${where}.id deve ser uma string não vazia`);
  }
  if (typeof raw.prompt?.subject !== "string" || raw.prompt.subject.length === 0) {
    throw new RegistryError(`${where}.prompt.subject deve ser uma string não vazia`);
  }
  const { width, height } = raw.size ?? {};
  for (const dim of ["width", "height"]) {
    const value = raw.size?.[dim];
    if (!Number.isInteger(value) || value <= 0 || value % 2 !== 0) {
      throw new RegistryError(
        `${where}.size.${dim} deve ser um inteiro positivo e par (recebido: ${value})`,
      );
    }
  }
  if (typeof raw.output?.project !== "string" || raw.output.project.length === 0) {
    throw new RegistryError(`${where}.output.project deve ser uma string não vazia`);
  }
  if (typeof raw.output?.dir !== "string" || raw.output.dir.length === 0) {
    throw new RegistryError(`${where}.output.dir deve ser uma string não vazia`);
  }
  if (raw.output?.filename !== null && typeof raw.output?.filename !== "string") {
    throw new RegistryError(`${where}.output.filename deve ser string ou null`);
  }
  if (!VALID_SEED_POLICIES.has(raw.seedPolicy)) {
    throw new RegistryError(`${where}.seedPolicy deve ser "random" ou "fixed"`);
  }
  if (raw.seedPolicy === "fixed" && !Number.isInteger(raw.seed)) {
    throw new RegistryError(`${where}.seedPolicy "fixed" exige seed inteiro`);
  }
  if (raw.postprocess !== null && typeof raw.postprocess !== "object") {
    throw new RegistryError(`${where}.postprocess deve ser null ou objeto`);
  }
  return { ...raw, size: { width, height } };
}

/**
 * Load and validate registry.json — the single source of truth for asset
 * generation (style suffix, negative prompt, per-type prompts/dims/output).
 *
 * @param {string | URL} [filePath] registry path (defaults to the bundled one)
 * @returns {Promise<{version: number, style: {suffix: string, negative: string}, types: object[]}>}
 * @throws {RegistryError} on unreadable/malformed JSON or schema violation
 */
export async function loadRegistry(filePath = DEFAULT_REGISTRY_PATH) {
  let raw;
  try {
    raw = JSON.parse(await readFile(filePath, "utf8"));
  } catch (err) {
    if (err instanceof SyntaxError) throw new RegistryError(`JSON malformado (${err.message})`);
    throw new RegistryError(`não foi possível ler ${filePath} (${err.code ?? err.message})`);
  }
  if (typeof raw !== "object" || raw === null) throw new RegistryError("raiz deve ser um objeto");
  if (raw.version !== 1) throw new RegistryError(`version deve ser 1 (recebido: ${raw.version})`);
  if (typeof raw.style?.suffix !== "string" || raw.style.suffix.length === 0) {
    throw new RegistryError("style.suffix deve ser uma string não vazia");
  }
  if (typeof raw.style?.negative !== "string" || raw.style.negative.length === 0) {
    throw new RegistryError("style.negative deve ser uma string não vazia");
  }
  if (!Array.isArray(raw.types) || raw.types.length === 0) {
    throw new RegistryError("types deve ser um array não vazio");
  }
  const types = raw.types.map(validateType);
  const ids = new Set(types.map((t) => t.id));
  if (ids.size !== types.length) throw new RegistryError("ids de tipo devem ser únicos");
  return { ...raw, types };
}
