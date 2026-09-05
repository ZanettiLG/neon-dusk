/**
 * Prompt builder — concatenates the type subject with the canonical noir
 * style suffix (positive) and reuses the shared negative block. The style
 * lives in registry.json so prompts stay data, not code.
 */

/**
 * Build the positive/negative prompt pair for an asset type.
 *
 * @param {{prompt: {subject: string}}} type validated registry type entry
 * @param {{style: {suffix: string, negative: string}}} registry loaded registry
 * @returns {{positive: string, negative: string}}
 */
export function buildPrompt(type, registry) {
  return {
    positive: `${type.prompt.subject}, ${registry.style.suffix}`,
    negative: registry.style.negative,
  };
}
