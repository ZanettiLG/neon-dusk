/**
 * Prompt builder — concatenates the type subject with the canonical noir
 * style suffix of the type's regime (positive) and reuses the regime's shared
 * negative block. Styles live in registry.json so prompts stay data, not code.
 */
import { RegistryError } from "./errors.mjs";

/**
 * Build the positive/negative prompt pair for an asset type.
 *
 * @param {{id: string, regime: "flat" | "atmospheric", prompt: {subject: string}}} type validated registry type entry
 * @param {{style: {flat: {suffix: string, negative: string}, atmospheric: {suffix: string, negative: string}}}} registry loaded registry
 * @param {{subject?: string, district?: {prompt: string, accent: string}}} [opts] per-asset overrides: a specific subject and/or a
 *   district entry (registry.districts[]). Omit for the plain type prompt (backward compatible).
 * @returns {{positive: string, negative: string}} composition order: base subject → district fragment → specific subject → regime suffix
 */
export function buildPrompt(type, registry, opts = {}) {
  const regime = registry.style[type.regime];
  if (!regime) throw new RegistryError(`tipo ${type.id} sem regime válido (${type.regime})`);
  const districtFragment = opts.district
    ? `${opts.district.prompt}, acento funcional ${opts.district.accent}`
    : null;
  const positive = [type.prompt.subject, districtFragment, opts.subject, regime.suffix]
    .filter(Boolean)
    .join(", ");
  return { positive, negative: regime.negative };
}
