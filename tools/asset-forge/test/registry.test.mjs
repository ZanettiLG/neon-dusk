/* global URL */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadRegistry } from "../src/registry.mjs";
import { RegistryError } from "../src/errors.mjs";

const REGISTRY_PATH = new URL("../registry.json", import.meta.url);

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

describe("registry", () => {
  it("should load the bundled registry with the 4 asset types", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    assert.deepEqual(registry.types.map((t) => t.id).sort(), [
      "avatar",
      "body-map",
      "icon",
      "metro-map",
    ]);
  });

  it("should carry the noir style block (suffix + negative)", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    assert.ok(registry.style.suffix.includes("noir cyberpunk brasileiro"));
    assert.ok(registry.style.negative.includes("watermark"));
  });

  it("should define body-map at 512×1024 with a canonical filename", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    const bodyMap = registry.types.find((t) => t.id === "body-map");
    assert.deepEqual(bodyMap.size, { width: 512, height: 1024 });
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

  it("should have unique ids and a valid seedPolicy per type", async () => {
    const registry = await loadRegistry(REGISTRY_PATH);
    const ids = registry.types.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const type of registry.types) {
      assert.ok(["random", "fixed"].includes(type.seedPolicy));
      assert.ok(type.prompt.subject.length > 0);
    }
  });

  it("should reject malformed JSON with RegistryError", async () => {
    await assert.rejects(() => loadFromTemp("{ nope"), RegistryError);
  });

  it("should reject odd dimensions with RegistryError", async () => {
    const bad = {
      version: 1,
      style: { suffix: "s", negative: "n" },
      types: [
        {
          id: "x",
          prompt: { subject: "s" },
          size: { width: 511, height: 1024 },
          output: { project: "app", dir: "d", filename: null },
          seedPolicy: "random",
          postprocess: null,
        },
      ],
    };
    await assert.rejects(() => loadFromTemp(JSON.stringify(bad)), /inteiro positivo e par/);
  });

  it("should reject duplicate ids and unknown seedPolicy", async () => {
    const dup = {
      version: 1,
      style: { suffix: "s", negative: "n" },
      types: [
        {
          id: "x",
          prompt: { subject: "s" },
          size: { width: 8, height: 8 },
          output: { project: "app", dir: "d", filename: null },
          seedPolicy: "random",
          postprocess: null,
        },
        {
          id: "x",
          prompt: { subject: "s" },
          size: { width: 8, height: 8 },
          output: { project: "app", dir: "d", filename: null },
          seedPolicy: "random",
          postprocess: null,
        },
      ],
    };
    await assert.rejects(() => loadFromTemp(JSON.stringify(dup)), /únicos/);

    dup.types[1].id = "y";
    dup.types[1].seedPolicy = "sometimes";
    await assert.rejects(() => loadFromTemp(JSON.stringify(dup)), /seedPolicy/);
  });

  it("should reject missing style fields and a wrong version", async () => {
    const noStyle = { version: 1, types: [] };
    await assert.rejects(() => loadFromTemp(JSON.stringify(noStyle)), RegistryError);
    await assert.rejects(
      () =>
        loadFromTemp(
          JSON.stringify({ ...noStyle, style: { suffix: "s", negative: "n" }, version: 2 }),
        ),
      /version/,
    );
  });
});
