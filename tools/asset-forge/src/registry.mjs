/* global URL */
import { readFile } from "node:fs/promises";
import { RegistryError } from "./errors.mjs";

const DEFAULT_REGISTRY_PATH = new URL("../registry.json", import.meta.url);

const VALID_SEED_POLICIES = new Set(["random", "fixed"]);
const VALID_REGIMES = new Set(["flat", "atmospheric"]);

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
  if (!VALID_REGIMES.has(raw.regime)) {
    throw new RegistryError(`${where}.regime deve ser "flat" ou "atmospheric" (recebido: ${raw.regime})`);
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
  if (raw.postprocess !== null && typeof raw.postprocess.rembg !== "boolean") {
    throw new RegistryError(`${where}.postprocess.rembg deve ser booleano`);
  }
  return { ...raw, size: { width, height } };
}

/**
 * Validate the seedFamilies array — named, non-empty member lists that
 * reference existing asset types.
 * @param {unknown} seedFamilies raw JSON value
 * @param {Set<string>} typeIds validated type ids
 * @returns {object[]} the validated families
 */
function validateSeedFamilies(seedFamilies, typeIds) {
  if (!Array.isArray(seedFamilies) || seedFamilies.length === 0) {
    throw new RegistryError("seedFamilies deve ser um array não vazio");
  }
  const ids = new Set();
  for (const [index, family] of seedFamilies.entries()) {
    const where = `seedFamilies[${index}]`;
    if (typeof family !== "object" || family === null) {
      throw new RegistryError(`${where} deve ser um objeto`);
    }
    if (typeof family.id !== "string" || family.id.length === 0) {
      throw new RegistryError(`${where}.id deve ser uma string não vazia`);
    }
    if (ids.has(family.id)) throw new RegistryError("ids de seedFamilies devem ser únicos");
    ids.add(family.id);
    if (!typeIds.has(family.type)) {
      throw new RegistryError(`${where}.type referencia tipo inexistente (${family.type})`);
    }
    if (
      !Array.isArray(family.members) ||
      family.members.length === 0 ||
      family.members.some((m) => typeof m !== "string" || m.length === 0)
    ) {
      throw new RegistryError(`${where}.members deve ser um array não vazio de strings`);
    }
  }
  return seedFamilies;
}

/**
 * Validate the districts array — the per-district accent (color) and prompt
 * used by atmospheric scenes and the baseline gate.
 * @param {unknown} districts raw JSON value
 * @returns {object[]} the validated districts
 */
function validateDistricts(districts) {
  if (!Array.isArray(districts) || districts.length === 0) {
    throw new RegistryError("districts deve ser um array não vazio");
  }
  const ids = new Set();
  for (const [index, district] of districts.entries()) {
    const where = `districts[${index}]`;
    if (typeof district !== "object" || district === null) {
      throw new RegistryError(`${where} deve ser um objeto`);
    }
    for (const field of ["id", "name", "accent", "prompt"]) {
      if (typeof district[field] !== "string" || district[field].length === 0) {
        throw new RegistryError(`${where}.${field} deve ser uma string não vazia`);
      }
    }
    if (ids.has(district.id)) throw new RegistryError("ids de districts devem ser únicos");
    ids.add(district.id);
  }
  return districts;
}

/**
 * Load and validate registry.json — the single source of truth for asset
 * generation (per-regime style suffix/negative, per-type prompts/dims/output,
 * seed families and district accents).
 *
 * @param {string | URL} [filePath] registry path (defaults to the bundled one)
 * @returns {Promise<{version: number, style: {flat: {suffix: string, negative: string}, atmospheric: {suffix: string, negative: string}}, types: object[], seedFamilies: object[], districts: object[]}>}
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
  if (raw.version !== 2) throw new RegistryError(`version deve ser 2 (recebido: ${raw.version})`);
  for (const regime of VALID_REGIMES) {
    if (typeof raw.style?.[regime]?.suffix !== "string" || raw.style[regime].suffix.length === 0) {
      throw new RegistryError(`style.${regime}.suffix deve ser uma string não vazia`);
    }
    if (typeof raw.style?.[regime]?.negative !== "string" || raw.style[regime].negative.length === 0) {
      throw new RegistryError(`style.${regime}.negative deve ser uma string não vazia`);
    }
  }
  if (!Array.isArray(raw.types) || raw.types.length === 0) {
    throw new RegistryError("types deve ser um array não vazio");
  }
  const types = raw.types.map(validateType);
  const ids = new Set(types.map((t) => t.id));
  if (ids.size !== types.length) throw new RegistryError("ids de tipo devem ser únicos");
  const seedFamilies = validateSeedFamilies(raw.seedFamilies, ids);
  const districts = validateDistricts(raw.districts);
  return { ...raw, types, seedFamilies, districts };
}