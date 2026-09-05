/**
 * ComfyUI API workflow template for SD1.5 txt2img (checkpoint dreamshaper_8).
 * Node ids follow the de-facto default graph; parameters (steps 28, cfg 7,
 * euler/normal, denoise 1) are the values proven by the Studio 21 pipeline.
 */

/** Checkpoint the provider expects on the ComfyUI host (validated by `check`). */
export const CHECKPOINT = "dreamshaper_8.safetensors";

/**
 * Build the ComfyUI API-format workflow JSON for one generation.
 *
 * @param {{id: string, size: {width: number, height: number}}} type registry type
 * @param {{positive: string, negative: string}} prompts from buildPrompt
 * @param {number} seed sampler seed (fixed or random, chosen by the CLI)
 * @param {string} [checkpoint] checkpoint filename override (CLI --checkpoint)
 * @returns {object} workflow graph (POST to /prompt)
 */
export function buildWorkflow(type, prompts, seed, checkpoint = CHECKPOINT) {
  const { width, height } = type.size;
  return {
    3: {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 28,
        cfg: 7,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    4: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
    5: { class_type: "EmptyLatentImage", inputs: { width, height, batch_size: 1 } },
    6: { class_type: "CLIPTextEncode", inputs: { text: prompts.positive, clip: ["4", 1] } },
    7: { class_type: "CLIPTextEncode", inputs: { text: prompts.negative, clip: ["4", 1] } },
    8: { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
    9: {
      class_type: "SaveImage",
      inputs: { filename_prefix: `nd-${type.id}`, images: ["8", 0] },
    },
  };
}
