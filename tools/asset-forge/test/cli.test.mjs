/* global Buffer */
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
 * @param {{history: object, checkpoint?: boolean}} opts
 */
function startMockComfy({ history, checkpoint = true }) {
  return new Promise((resolve) => {
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
        req.resume();
        req.on("end", () => {
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
});