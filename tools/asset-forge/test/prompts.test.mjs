/* global URL */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRegistry } from "../src/registry.mjs";
import { buildPrompt } from "../src/prompts.mjs";

const REGISTRY_PATH = new URL("../registry.json", import.meta.url);

// IP guard: banned terms (docs/definicoes-de-produto/06-terminologia-e-ip.md)
// must never leak into a generated positive prompt. The negative prompt is
// ALLOWED (and required) to name them — as explicit prohibitions.
const BANNED_IP_TERMS = [
  "Kiroshi",
  "MaxTac",
  "Sandevistan",
  "Mantis Blades",
  "Gorilla Arms",
  "Monowire",
  "Trauma Team",
  "Blackwall",
  "Braindance",
  "Night City",
  "Johnny Silverhand",
];

describe("prompts", () => {
  it("should concatenate subject + flat noir suffix in the positive prompt", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    const type = registry.types.find((t) => t.id === "body-map");

    const { positive } = buildPrompt(type, registry);

    assert.ok(positive.startsWith(type.prompt.subject));
    assert.ok(positive.includes("noir cyberpunk brasileiro"));
    assert.ok(positive.includes("fundo escuro #0a0a0a"));
    assert.ok(positive.includes("arms slightly apart from torso"));
  });

  it("should reuse the negative block of the type's regime verbatim", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    const type = registry.types.find((t) => t.id === "body-map");

    const { negative } = buildPrompt(type, registry);

    assert.equal(negative, registry.style[type.regime].negative);
    // Prohibition clauses stay in the negative (design §3.1):
    assert.ok(negative.includes("Cyberpunk 2077"));
    assert.ok(negative.includes("dedos extras, membros deformados"));
    assert.ok(negative.includes("glow neon"));
  });

  it("should never put banned IP terms in the positive prompt", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    for (const type of registry.types) {
      const { positive } = buildPrompt(type, registry);
      for (const term of BANNED_IP_TERMS) {
        assert.ok(!positive.includes(term), `"${term}" vazou no positive de ${type.id}`);
      }
    }
  });

  it("should apply the regime noir suffix to every asset type", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    for (const type of registry.types) {
      const { positive } = buildPrompt(type, registry);
      assert.ok(positive.startsWith(type.prompt.subject), `${type.id} deve começar com o subject`);
      assert.ok(
        positive.includes("noir cyberpunk brasileiro"),
        `${type.id} deve carregar o sufixo noir`,
      );
    }
  });

  it("should load atmospheric lighting in atmospheric positives and flat lighting in flat ones", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    for (const type of registry.types) {
      const { positive } = buildPrompt(type, registry);
      if (type.regime === "atmospheric") {
        assert.ok(positive.includes("luz volumétrica"), `${type.id} deve carregar luz volumétrica`);
        assert.ok(positive.includes("néon apenas como luz ambiente ao fundo"), `${type.id} deve restringir néon ao fundo`);
        assert.ok(!positive.includes("iluminação plana uniforme"), `${type.id} não deve carregar luz plana`);
      } else {
        assert.ok(positive.includes("iluminação plana uniforme"), `${type.id} deve carregar iluminação plana`);
        assert.ok(!positive.includes("luz volumétrica"), `${type.id} não deve carregar luz volumétrica`);
      }
    }
  });
});