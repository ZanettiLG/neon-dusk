import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildWorkflow, CHECKPOINT } from "../src/workflow.mjs";

const TYPE = {
  id: "body-map",
  size: { width: 512, height: 1024 },
};

const PROMPTS = {
  positive: "corpo humano adulto magro, noir",
  negative: "texto, glow neon",
};

describe("workflow", () => {
  const wf = buildWorkflow(TYPE, PROMPTS, 482913);

  it("should build the standard SD1.5 txt2img graph (7 nodes)", () => {
    assert.deepEqual(Object.keys(wf).sort(), ["3", "4", "5", "6", "7", "8", "9"]);
    assert.equal(wf["3"].class_type, "KSampler");
    assert.equal(wf["4"].class_type, "CheckpointLoaderSimple");
    assert.equal(wf["5"].class_type, "EmptyLatentImage");
    assert.equal(wf["6"].class_type, "CLIPTextEncode");
    assert.equal(wf["7"].class_type, "CLIPTextEncode");
    assert.equal(wf["8"].class_type, "VAEDecode");
    assert.equal(wf["9"].class_type, "SaveImage");
  });

  it("should wire the checkpoint loader into model/clip/vae", () => {
    assert.deepEqual(wf["3"].inputs.model, ["4", 0]);
    assert.deepEqual(wf["6"].inputs.clip, ["4", 1]);
    assert.deepEqual(wf["7"].inputs.clip, ["4", 1]);
    assert.deepEqual(wf["8"].inputs.vae, ["4", 2]);
    assert.deepEqual(wf["8"].inputs.samples, ["3", 0]);
    assert.deepEqual(wf["9"].inputs.images, ["8", 0]);
  });

  it("should pin the dreamshaper_8 checkpoint and proven params", () => {
    assert.equal(CHECKPOINT, "dreamshaper_8.safetensors");
    assert.equal(wf["4"].inputs.ckpt_name, "dreamshaper_8.safetensors");
    assert.equal(wf["3"].inputs.steps, 28);
    assert.equal(wf["3"].inputs.cfg, 7);
    assert.equal(wf["3"].inputs.sampler_name, "euler");
    assert.equal(wf["3"].inputs.scheduler, "normal");
    assert.equal(wf["3"].inputs.denoise, 1);
  });

  it("should accept a checkpoint override via --checkpoint (CLI flag > default)", () => {
    assert.equal(
      buildWorkflow(TYPE, PROMPTS, 1, "v1-5-pruned-emaonly.safetensors")["4"].inputs.ckpt_name,
      "v1-5-pruned-emaonly.safetensors",
    );
    assert.equal(buildWorkflow(TYPE, PROMPTS, 1)["4"].inputs.ckpt_name, CHECKPOINT);
  });

  it("should take dims from the registry and inject the seed", () => {
    assert.deepEqual(wf["5"].inputs, { width: 512, height: 1024, batch_size: 1 });
    assert.equal(wf["3"].inputs.seed, 482913);
    assert.equal(buildWorkflow(TYPE, PROMPTS, 7)["3"].inputs.seed, 7);
  });

  it("should route positive/negative text and name the output nd-<tipo>", () => {
    assert.equal(wf["6"].inputs.text, PROMPTS.positive);
    assert.equal(wf["7"].inputs.text, PROMPTS.negative);
    assert.equal(wf["9"].inputs.filename_prefix, "nd-body-map");
    assert.equal(
      buildWorkflow({ ...TYPE, id: "icon" }, PROMPTS, 1)["9"].inputs.filename_prefix,
      "nd-icon",
    );
  });
});
