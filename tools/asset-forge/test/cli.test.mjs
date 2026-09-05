/* global Buffer, URL, process */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Issue #94 — CLI exit-code contract (design §2.3): 0 ok · 1 unexpected ·
// 2 usage/registry · 3 ComfyUI offline · 4 generation failed · 5 timeout.
// The CLI runs main() on import, so the only honest way to assert exit codes
// is spawning it as a subprocess. Network paths use a local mock ComfyUI
// (node:http) — zero external dependencies.

const execFileAsync = promisify(execFile);
const CLI = fileURLToPath(new URL("../cli.mjs", import.meta.url));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Run the CLI as a subprocess; resolves { code, stdout, stderr }. */
async function runCli(args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...args], {
      timeout: 20_000,
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

/**
 * Minimal ComfyUI mock: /system_stats, /object_info/CheckpointLoaderSimple,
 * POST /prompt → { prompt_id }, /history/{id} → canned history, /view → PNG.
 * @param {{history: object, checkpoint?: boolean, failPostAt?: number}} opts
 *   failPostAt (1-based): the Nth POST /prompt answers 500 (batch-failure test).
 */
function startMockComfy({ history, checkpoint = true, failPostAt = 0 }) {
  return new Promise((resolve) => {
    let promptCount = 0;
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/system_stats") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ system: { comfyui_version: "1.0" } }));
      } else if (url.pathname === "/object_info/CheckpointLoaderSimple") {
        const names = checkpoint
          ? [["dreamshaper_8.safetensors"], {}]
          : [["other.safetensors"], {}];
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            CheckpointLoaderSimple: { input: { required: { ckpt_name: names } } },
          }),
        );
      } else if (url.pathname === "/prompt") {
        promptCount += 1;
        req.resume();
        req.on("end", () => {
          if (promptCount === failPostAt) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("boom");
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ prompt_id: "p-test" }));
        });
      } else if (url.pathname.startsWith("/history/")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(history));
      } else if (url.pathname === "/view") {
        res.writeHead(200, { "Content-Type": "image/png" });
        res.end(Buffer.from(PNG));
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

describe("cli", () => {
  it("list should print the 7 registry types and exit 0", async () => {
    const { code, stdout } = await runCli(["list"]);

    assert.equal(code, 0);
    for (const id of ["backdrop", "body-map", "gig-art", "icon", "item", "portrait", "scene"]) {
      assert.ok(stdout.includes(id), `stdout deve listar ${id}`);
    }
    assert.ok(stdout.includes("atmospheric"), "stdout deve mostrar o regime atmospheric");
    assert.ok(stdout.includes("flat"), "stdout deve mostrar o regime flat");
  });

  it("generate --dry-run should print the workflow JSON without network and exit 0", async () => {
    const { code, stdout } = await runCli(["generate", "body-map", "--dry-run", "--seed", "42"]);

    assert.equal(code, 0);
    const wf = JSON.parse(stdout.slice(stdout.indexOf("{")));
    assert.equal(wf["3"].inputs.seed, 42);
    assert.equal(wf["9"].inputs.filename_prefix, "nd-body-map");
  });

  it("--checkpoint should override the workflow checkpoint", async () => {
    const { code, stdout } = await runCli([
      "generate",
      "body-map",
      "--dry-run",
      "--checkpoint",
      "v1-5-pruned-emaonly.safetensors",
    ]);

    assert.equal(code, 0);
    const wf = JSON.parse(stdout.slice(stdout.indexOf("{")));
    assert.equal(wf["4"].inputs.ckpt_name, "v1-5-pruned-emaonly.safetensors");
  });

  it("should exit 2 for an unknown command", async () => {
    const { code, stderr } = await runCli(["frobnicate"]);

    assert.equal(code, 2);
    assert.match(stderr, /desconhecido/);
  });

  it("should point to 'list' instead of hardcoding types in the usage text", async () => {
    const { code, stderr } = await runCli(["frobnicate"]);

    assert.equal(code, 2);
    assert.match(stderr, /veja "list"/);
    // The usage text must not enumerate registry types (they live in
    // registry.json — a hardcoded list would drift).
    assert.doesNotMatch(stderr, /body-map/);
    assert.doesNotMatch(stderr, /gig-art/);
  });

  it("should list the valid types dynamically for an unknown type", async () => {
    const { code, stderr } = await runCli(["generate", "unicorn"]);

    assert.equal(code, 2);
    assert.match(stderr, /Tipo desconhecido/);
    // The error enumerates the registry types at runtime, not a hardcoded list.
    assert.match(stderr, /body-map/);
    assert.match(stderr, /gig-art/);
  });

  it("should exit 2 for generate without a type", async () => {
    const { code, stderr } = await runCli(["generate"]);

    assert.equal(code, 2);
    assert.match(stderr, /exige exatamente um tipo/);
  });

  it("should exit 2 for an unknown asset type", async () => {
    const { code, stderr } = await runCli(["generate", "unicorn"]);

    assert.equal(code, 2);
    assert.match(stderr, /Tipo desconhecido/);
  });

  it("should exit 2 for an invalid flag value", async () => {
    const { code, stderr } = await runCli(["generate", "body-map", "--variants", "0"]);

    assert.equal(code, 2);
    assert.match(stderr, /inteiro positivo/);
  });

  it("should exit 3 with a clear message when ComfyUI is offline", async () => {
    // Port 1 is never bound — fetch rejects with ECONNREFUSED.
    const { code, stderr } = await runCli([
      "generate",
      "body-map",
      "--url",
      "http://127.0.0.1:1",
    ]);

    assert.equal(code, 3);
    assert.match(stderr, /ComfyUI offline/);
  });

  it("generate should run the full flow against a mock ComfyUI and write the PNG", async () => {
    const { server, url } = await startMockComfy({
      history: {
        "p-test": {
          status: { status_str: "success", completed: true },
          outputs: {
            9: { images: [{ filename: "nd-body-map.png", subfolder: "", type: "output" }] },
          },
        },
      },
    });
    const outDir = await mkdtemp(path.join(tmpdir(), "asset-forge-out-"));
    try {
      const { code, stdout } = await runCli([
        "generate",
        "body-map",
        "--url",
        url,
        "--out",
        outDir,
        "--seed",
        "7",
      ]);

      assert.equal(code, 0);
      assert.match(stdout, /1 variante gerada/);
      assert.deepEqual(await readdir(outDir), ["body-map-7.png"]);
      assert.deepEqual([...(await readFile(path.join(outDir, "body-map-7.png")))], [...PNG]);
    } finally {
      await rm(outDir, { recursive: true, force: true });
      server.close();
    }
  });

  it("check should exit 0 when the server and checkpoint are present", async () => {
    const { server, url } = await startMockComfy({ history: {} });
    try {
      const { code, stdout } = await runCli(["check", "--url", url]);

      assert.equal(code, 0);
      assert.match(stdout, /ComfyUI ok/);
    } finally {
      server.close();
    }
  });

  it("should exit 4 when the checkpoint is absent", async () => {
    const { server, url } = await startMockComfy({ history: {}, checkpoint: false });
    try {
      const { code, stderr } = await runCli(["generate", "body-map", "--url", url]);

      assert.equal(code, 4);
      assert.match(stderr, /Checkpoint/);
    } finally {
      server.close();
    }
  });

  it("should exit 4 when ComfyUI reports a generation error in history", async () => {
    const { server, url } = await startMockComfy({
      history: {
        "p-test": {
          status: {
            status_str: "error",
            completed: false,
            messages: [["execution_error", "CUDA out of memory"]],
          },
        },
      },
    });
    try {
      const { code, stderr } = await runCli(["generate", "body-map", "--url", url]);

      assert.equal(code, 4);
      assert.match(stderr, /CUDA out of memory/);
    } finally {
      server.close();
    }
  });

  it("should exit 5 when generation exceeds the timeout", async () => {
    const { server, url } = await startMockComfy({ history: {} });
    try {
      const { code, stderr } = await runCli([
        "generate",
        "body-map",
        "--url",
        url,
        "--timeout",
        "1",
      ]);

      assert.equal(code, 5);
      assert.match(stderr, /não completou/);
    } finally {
      server.close();
    }
  });

  // Issue #199 — family generation: deterministic seeds per member, one PNG
  // per member named <member>.png, per-member failures collected (batch keeps
  // going, exit code = worst failure).
  const FAMILY_HISTORY = {
    "p-test": {
      status: { status_str: "success", completed: true },
      outputs: { 9: { images: [{ filename: "nd-item.png", subfolder: "", type: "output" }] } },
    },
  };
  const CROMO_FILES = Array.from(
    { length: 12 },
    (_, i) => `cromo-${String(i + 1).padStart(2, "0")}.png`,
  );

  describe("family mode", () => {
    it("--dry-run should list all members with seeds and the first member workflow", async () => {
      const { code, stdout } = await runCli([
        "generate",
        "item",
        "--family",
        "itens-cromo",
        "--dry-run",
      ]);

      assert.equal(code, 0);
      assert.match(stdout, /\[dry-run\] família itens-cromo \(12 members\):/);
      for (const memberId of ["cromo-01", "cromo-02", "cromo-12"]) {
        assert.match(stdout, new RegExp(`${memberId} → seed \\d+`));
      }
      // First "{" starts the first member's workflow JSON (lines above are brace-free).
      const wf = JSON.parse(stdout.slice(stdout.indexOf("{")));
      assert.equal(wf["9"].inputs.filename_prefix, "nd-cromo-01");
      assert.equal(wf["3"].inputs.seed, 801015425); // familySeed("itens-cromo", "cromo-01")
    });

    it("should generate the whole family and write <member>.png per member", async () => {
      const { server, url } = await startMockComfy({ history: FAMILY_HISTORY });
      const outDir = await mkdtemp(path.join(tmpdir(), "asset-forge-family-"));
      try {
        const { code, stdout } = await runCli([
          "generate",
          "item",
          "--family",
          "itens-cromo",
          "--url",
          url,
          "--out",
          outDir,
        ]);

        assert.equal(code, 0);
        assert.match(stdout, /✓ 12\/12 gerados/);
        assert.match(
          stdout,
          /\[3\/12\] cromo-03 → .*cromo-03\.png \(seed \d+, 512×512, \d+\.\d+s\)/,
        );
        assert.deepEqual((await readdir(outDir)).sort(), CROMO_FILES);
      } finally {
        await rm(outDir, { recursive: true, force: true });
        server.close();
      }
    });

    it("--member should generate only that member", async () => {
      const { server, url } = await startMockComfy({ history: FAMILY_HISTORY });
      const outDir = await mkdtemp(path.join(tmpdir(), "asset-forge-member-"));
      try {
        const { code, stdout } = await runCli([
          "generate",
          "item",
          "--family",
          "itens-cromo",
          "--member",
          "cromo-03",
          "--url",
          url,
          "--out",
          outDir,
        ]);

        assert.equal(code, 0);
        assert.match(stdout, /✓ 1\/1 gerados/);
        assert.deepEqual(await readdir(outDir), ["cromo-03.png"]);
      } finally {
        await rm(outDir, { recursive: true, force: true });
        server.close();
      }
    });

    it("should be deterministic across runs (dry-run twice → same seed for cromo-01)", async () => {
      const seedOf = async () => {
        const { stdout } = await runCli([
          "generate",
          "item",
          "--family",
          "itens-cromo",
          "--dry-run",
        ]);
        return stdout.match(/cromo-01 → seed (\d+)/)?.[1];
      };

      assert.equal(await seedOf(), await seedOf());
      assert.equal(await seedOf(), "801015425");
    });

    it("should keep the batch going when one member fails and exit with the worst code", async () => {
      // The 3rd POST (cromo-03) answers 500 — the other 11 still generate.
      const { server, url } = await startMockComfy({ history: FAMILY_HISTORY, failPostAt: 3 });
      const outDir = await mkdtemp(path.join(tmpdir(), "asset-forge-partial-"));
      try {
        const { code, stderr } = await runCli([
          "generate",
          "item",
          "--family",
          "itens-cromo",
          "--url",
          url,
          "--out",
          outDir,
        ]);

        assert.equal(code, 4);
        assert.match(stderr, /cromo-03 \(ComfyUI respondeu HTTP 500: boom\)/);
        assert.match(stderr, /✓ 11\/12 gerados/);
        const files = await readdir(outDir);
        assert.equal(files.length, 11);
        assert.ok(!files.includes("cromo-03.png"));
      } finally {
        await rm(outDir, { recursive: true, force: true });
        server.close();
      }
    });

    it("should exit 2 for every family/district/subject misuse, before any generation", async () => {
      const cases = [
        [
          ["generate", "item", "--family", "nao-existe"],
          /Família desconhecida: "nao-existe".*Famílias válidas.*itens-cromo/s,
        ],
        [
          ["generate", "item", "--family", "itens-cromo", "--member", "cromo-99"],
          /não pertence à família "itens-cromo"/,
        ],
        [["generate", "scene", "--family", "itens-cromo"], /incompatível com "scene"/],
        [["generate", "item", "--district", "babilonia"], /distrito só para regime atmospheric/],
        [
          ["generate", "scene", "--district", "vila-madalena"],
          /Distrito desconhecido: "vila-madalena"/,
        ],
        [
          ["generate", "item", "--family", "itens-cromo", "--seed", "7"],
          /--seed e --variants não combinam/,
        ],
        [
          ["generate", "item", "--family", "itens-cromo", "--variants", "3"],
          /--seed e --variants não combinam/,
        ],
        [["generate", "item", "--member", "cromo-03"], /--member exige --family/],
        [["generate", "item", "--subject", ""], /--subject não pode ser vazio/],
        [["generate", "item", "--subject", "   "], /--subject não pode ser vazio/],
      ];
      for (const [args, expected] of cases) {
        const { code, stderr } = await runCli(args);
        assert.equal(code, 2, `esperado exit 2 para: ${args.join(" ")}`);
        assert.match(stderr, expected);
      }
    });

    it("plain mode --subject should append to the prompt and keep the current naming", async () => {
      const { code, stdout } = await runCli([
        "generate",
        "item",
        "--subject",
        "chave física sem haste",
        "--dry-run",
        "--seed",
        "9",
      ]);

      assert.equal(code, 0);
      const wf = JSON.parse(stdout.slice(stdout.indexOf("{")));
      assert.match(wf["6"].inputs.text, /chave física sem haste/);
      assert.equal(wf["9"].inputs.filename_prefix, "nd-item");
    });
  });
});
