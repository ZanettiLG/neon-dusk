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
 * @returns {{positive: string, negative: string}}
 */
export function buildPrompt(type, registry) {
  const regime = registry.style[type.regime];
  if (!regime) throw new RegistryError(`tipo ${type.id} sem regime válido (${type.regime})`);
  return {
    positive: `${type.prompt.subject}, ${regime.suffix}`,
    negative: regime.negative,
  };
}