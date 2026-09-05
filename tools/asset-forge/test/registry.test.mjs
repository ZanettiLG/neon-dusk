/* global URL */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadRegistry } from "../src/registry.mjs";
import { RegistryError } from "../src/errors.mjs";

const REGISTRY_PATH = new URL("../registry.json", import.meta.url);

/**
 * Minimal valid v2 registry — error fixtures mutate a copy.
 * @returns {object} a valid registry object
 */
function baseRegistry(overrides = {}) {
  return {
    version: 2,
    style: {
      flat: { suffix: "noir cyberpunk brasileiro, iluminação plana", negative: "texto, glow neon" },
      atmospheric: {
        suffix: "noir cyberpunk brasileiro, luz volumétrica",
        negative: "texto, glow neon sobre o assunto",
      },
    },
    types: [
      {
        id: "body-map",
        regime: "flat",
        prompt: { subject: "anatomical body chart" },
        size: { width: 512, height: 1024 },
        output: { project: "app", dir: "app/src/assets/chrome", filename: "body-map.png" },
        seedPolicy: "random",
        postprocess: { rembg: true },
      },
      {
        id: "icon",
        regime: "flat",
        prompt: { subject: "silhueta única" },
        size: { width: 512, height: 512 },
        output: { project: "app", dir: "app/src/assets/icons", filename: null },
        seedPolicy: "random",
        postprocess: null,
      },
    ],
    seedFamilies: [{ id: "fam-a", type: "body-map", members: ["a1", "a2"] }],
    districts: [
      { id: "babilonia", name: "Babilônia", accent: "âmbar #d4a017", prompt: "mercado caótico" },
    ],
    ...overrides,
  };
}

/** Write a registry to a temp dir and load it. @returns {Promise<void>} rejects like loadRegistry */
async function loadFromTemp(json) {
  const dir = await mkdtemp(path.join(tmpdir(), "asset-forge-registry-"));
  const file = path.join(dir, "registry.json");
  try {
    await writeFile(file, json);
    return await loadRegistry(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const rejectFixture = (overrides, message) =>
  assert.rejects(() => loadFromTemp(JSON.stringify(baseRegistry(overrides))), message);

describe("registry", () => {
  it("should load the bundled registry with the 7 asset types", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    assert.deepEqual(registry.types.map((t) => t.id).sort(), [
      "backdrop",
      "body-map",
      "gig-art",
      "icon",
      "item",
      "portrait",
      "scene",
    ]);
  });

  it("should carry both style regimes (flat + atmospheric)", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    assert.ok(registry.style.flat.suffix.includes("noir cyberpunk brasileiro"));
    assert.ok(registry.style.flat.negative.includes("watermark"));
    assert.ok(registry.style.atmospheric.suffix.includes("luz volumétrica"));
    assert.ok(registry.style.atmospheric.negative.includes("iluminação plana sem profundidade"));
  });

  it("should define body-map at 512×1024, flat regime, rembg postprocess", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    const bodyMap = registry.types.find((t) => t.id === "body-map");
    assert.deepEqual(bodyMap.size, { width: 512, height: 1024 });
    assert.equal(bodyMap.regime, "flat");
    assert.deepEqual(bodyMap.postprocess, { rembg: true });
    assert.equal(bodyMap.output.filename, "body-map.png");
    assert.equal(bodyMap.output.dir, "app/src/assets/chrome");
  });

  it("should use even dimensions everywhere (EmptyLatentImage constraint)", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    for (const type of registry.types) {
      assert.equal(type.size.width % 2, 0, `${type.id}.width deve ser par`);
      assert.equal(type.size.height % 2, 0, `${type.id}.height deve ser par`);
    }
  });

  it("should have unique ids, a valid seedPolicy and a valid regime per type", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    const ids = registry.types.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const type of registry.types) {
      assert.ok(["random", "fixed"].includes(type.seedPolicy));
      assert.ok(type.prompt.subject.length > 0);
      assert.ok(["flat", "atmospheric"].includes(type.regime), `${type.id}.regime inválido`);
      assert.ok(registry.style[type.regime], `${type.id}.regime sem bloco de estilo`);
    }
  });

  it("should define 8 seed families with unique ids, valid type refs and non-empty members", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    const typeIds = new Set(registry.types.map((t) => t.id));
    const familyIds = registry.seedFamilies.map((f) => f.id);
    assert.equal(familyIds.length, 8);
    assert.equal(new Set(familyIds).size, familyIds.length);
    for (const family of registry.seedFamilies) {
      assert.ok(typeIds.has(family.type), `${family.id}.type inválido`);
      assert.ok(family.members.length > 0, `${family.id}.members vazio`);
      for (const member of family.members) {
        assert.ok(typeof member === "string" && member.length > 0);
      }
    }
  });

  it("should define 7 districts with unique ids and non-empty fields", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    const ids = registry.districts.map((d) => d.id);
    assert.equal(ids.length, 7);
    assert.equal(new Set(ids).size, ids.length);
    for (const district of registry.districts) {
      for (const field of ["id", "name", "accent", "prompt"]) {
        assert.ok(
          typeof district[field] === "string" && district[field].length > 0,
          `${district.id}.${field} deve ser string não vazia`,
        );
      }
    }
  });

  it("should reject malformed JSON with RegistryError", async () => {
    await assert.rejects(() => loadFromTemp("{ nope"), RegistryError);
  });

  it("should reject a missing registry file with RegistryError", async () => {
    const missing = path.join(tmpdir(), `asset-forge-missing-${Date.now()}.json`);
    await assert.rejects(() => loadRegistry(missing), RegistryError);
  });

  it("should reject odd dimensions with RegistryError", async () => {
    await rejectFixture(
      { types: [{ ...baseRegistry().types[0], size: { width: 511, height: 1024 } }] },
      /inteiro positivo e par/,
    );
  });

  it("should reject duplicate ids and unknown seedPolicy", async () => {
    const base = baseRegistry();
    const dup = {
      ...base,
      types: [base.types[0], { ...base.types[1], id: "body-map" }],
    };
    await assert.rejects(() => loadFromTemp(JSON.stringify(dup)), /únicos/);

    const badPolicy = {
      ...base,
      types: [{ ...base.types[0], seedPolicy: "sometimes" }],
    };
    await assert.rejects(() => loadFromTemp(JSON.stringify(badPolicy)), /seedPolicy/);
  });

  it("should reject missing style fields and versions other than 2", async () => {
    const base = baseRegistry();
    const noStyle = { ...base, style: {} };
    await assert.rejects(() => loadFromTemp(JSON.stringify(noStyle)), RegistryError);
    await assert.rejects(
      () => loadFromTemp(JSON.stringify({ ...base, version: 1 })),
      /version deve ser 2/,
    );
    await assert.rejects(
      () => loadFromTemp(JSON.stringify({ ...base, version: 3 })),
      /version deve ser 2/,
    );
  });

  it("should reject seedPolicy fixed without an integer seed", async () => {
    await rejectFixture(
      { types: [{ ...baseRegistry().types[0], seedPolicy: "fixed" }] },
      /seed/,
    );
  });

  it("should reject an invalid type regime", async () => {
    await rejectFixture(
      { types: [{ ...baseRegistry().types[0], regime: "vaporwave" }] },
      /regime deve ser "flat" ou "atmospheric"/,
    );
  });

  it("should reject a non-boolean rembg postprocess", async () => {
    await rejectFixture(
      { types: [{ ...baseRegistry().types[0], postprocess: { rembg: "yes" } }] },
      /postprocess\.rembg deve ser booleano/,
    );
    await rejectFixture(
      { types: [{ ...baseRegistry().types[0], postprocess: { rembg: 1 } }] },
      /postprocess\.rembg deve ser booleano/,
    );
  });

  it("should reject missing or empty seedFamilies", async () => {
    await rejectFixture({ seedFamilies: [] }, /seedFamilies deve ser um array não vazio/);
    await rejectFixture(
      { seedFamilies: [{ id: "x", type: "body-map", members: [] }] },
      /members deve ser um array não vazio/,
    );
  });

  it("should reject duplicate family ids and unknown family type refs", async () => {
    const base = baseRegistry();
    await rejectFixture(
      { seedFamilies: [base.seedFamilies[0], { ...base.seedFamilies[0] }] },
      /ids de seedFamilies devem ser únicos/,
    );
    await rejectFixture(
      { seedFamilies: [{ id: "x", type: "unicorn", members: ["a"] }] },
      /referencia tipo inexistente/,
    );
  });

  it("should reject missing or duplicate districts", async () => {
    const base = baseRegistry();
    await rejectFixture({ districts: [] }, /districts deve ser um array não vazio/);
    await rejectFixture(
      {
        districts: [
          base.districts[0],
          { ...base.districts[0], name: "Outra" },
        ],
      },
      /ids de districts devem ser únicos/,
    );
    await rejectFixture(
      { districts: [{ id: "x", name: "", accent: "cor", prompt: "p" }] },
      /districts\[0\]\.name deve ser uma string não vazia/,
    );
  });
});