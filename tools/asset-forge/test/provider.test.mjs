/* global Response */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkServer,
  checkCheckpoint,
  submitWorkflow,
  pollHistory,
  downloadImage,
} from "../src/provider.mjs";
import { ComfyOfflineError, HttpError, GenerationError, TimeoutError } from "../src/errors.mjs";

const BASE = "http://comfy.test:8188";

/** Fetch stub returning a canned Response for every call. */
function fetchOk(status, body, headers = { "Content-Type": "application/json" }) {
  const calls = [];
  const payload =
    typeof body === "string" || body instanceof ArrayBuffer || ArrayBuffer.isView(body)
      ? body
      : JSON.stringify(body);
  const impl = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(payload, { status, headers }));
  };
  impl.calls = calls;
  return impl;
}

/** Fetch stub whose every call rejects (server down). */
function fetchDown() {
  const impl = () => Promise.reject(new Error("ECONNREFUSED"));
  impl.calls = [];
  return impl;
}

describe("provider", () => {
  it("checkServer should GET /system_stats and parse the stats", async () => {
    const impl = fetchOk(200, { system: { comfyui_version: "1.0" } });
    const stats = await checkServer(BASE, { fetchImpl: impl });

    assert.equal(stats.system.comfyui_version, "1.0");
    assert.equal(impl.calls[0].url, `${BASE}/system_stats`);
  });

  it("checkServer should map connection failure to ComfyOfflineError", async () => {
    await assert.rejects(() => checkServer(BASE, { fetchImpl: fetchDown() }), ComfyOfflineError);
  });

  it("checkServer should map non-2xx to HttpError", async () => {
    await assert.rejects(() => checkServer(BASE, { fetchImpl: fetchOk(500, "boom") }), HttpError);
  });

  it("checkCheckpoint should accept the expected checkpoint", async () => {
    const info = {
      CheckpointLoaderSimple: {
        input: {
          required: { ckpt_name: [["dreamshaper_8.safetensors", "other.safetensors"], {}] },
        },
      },
    };
    await checkCheckpoint(BASE, "dreamshaper_8", { fetchImpl: fetchOk(200, info) });
  });

  it("checkCheckpoint should fail with GenerationError when the checkpoint is absent", async () => {
    const info = {
      CheckpointLoaderSimple: { input: { required: { ckpt_name: [["other.safetensors"], {}] } } },
    };
    await assert.rejects(
      () => checkCheckpoint(BASE, "dreamshaper_8", { fetchImpl: fetchOk(200, info) }),
      GenerationError,
    );
  });

  it("checkCheckpoint should map a non-2xx answer to HttpError", async () => {
    await assert.rejects(
      () => checkCheckpoint(BASE, "dreamshaper_8", { fetchImpl: fetchOk(500, "boom") }),
      HttpError,
    );
  });

  it("submitWorkflow should POST the graph and return prompt_id", async () => {
    const impl = fetchOk(200, { prompt_id: "p-1" });
    const id = await submitWorkflow(BASE, { 3: { class_type: "KSampler" } }, { fetchImpl: impl });

    assert.equal(id, "p-1");
    assert.equal(impl.calls[0].url, `${BASE}/prompt`);
    assert.equal(impl.calls[0].init.method, "POST");
    assert.deepEqual(JSON.parse(impl.calls[0].init.body).prompt, { 3: { class_type: "KSampler" } });
  });

  it("submitWorkflow should map HTTP 500 to HttpError", async () => {
    await assert.rejects(
      () => submitWorkflow(BASE, {}, { fetchImpl: fetchOk(500, "no gpu") }),
      /500/,
    );
  });

  it("submitWorkflow should map a body without prompt_id to HttpError", async () => {
    await assert.rejects(
      () => submitWorkflow(BASE, {}, { fetchImpl: fetchOk(200, { error: "x" }) }),
      HttpError,
    );
  });

  it("pollHistory should return the first image once status.completed", async () => {
    const empty = fetchOk(200, {});
    const done = fetchOk(200, {
      "p-9": {
        status: { status_str: "success", completed: true },
        outputs: {
          9: { images: [{ filename: "nd-body-map-00001.png", subfolder: "", type: "output" }] },
        },
      },
    });
    let call = 0;
    const impl = (url, init) => {
      impl.calls.push({ url, init });
      return call++ === 0 ? empty(url, init) : done(url, init);
    };
    impl.calls = [];

    const image = await pollHistory(BASE, "p-9", {
      fetchImpl: impl,
      intervalMs: 1,
      timeoutMs: 5_000,
    });

    assert.equal(image.filename, "nd-body-map-00001.png");
    assert.match(impl.calls[0].url, /\/history\/p-9$/);
  });

  it("pollHistory should map status_str=error to GenerationError with the ComfyUI message", async () => {
    const impl = fetchOk(200, {
      "p-e": {
        status: {
          status_str: "error",
          completed: false,
          messages: [["execution_error", "CUDA out of memory"]],
        },
      },
    });

    await assert.rejects(
      () => pollHistory(BASE, "p-e", { fetchImpl: impl, intervalMs: 1, timeoutMs: 5_000 }),
      (err) => err instanceof GenerationError && err.message.includes("CUDA out of memory"),
    );
  });

  it("pollHistory should map an empty outputs block to GenerationError", async () => {
    const impl = fetchOk(200, {
      "p-0": { status: { status_str: "success", completed: true }, outputs: {} },
    });

    await assert.rejects(
      () => pollHistory(BASE, "p-0", { fetchImpl: impl, intervalMs: 1, timeoutMs: 5_000 }),
      /sem imagens/,
    );
  });

  it("pollHistory should throw TimeoutError when the deadline passes", async () => {
    const impl = fetchOk(200, {});

    await assert.rejects(
      () => pollHistory(BASE, "p-t", { fetchImpl: impl, intervalMs: 1, timeoutMs: 20 }),
      TimeoutError,
    );
  });

  it("pollHistory should map a non-2xx answer to HttpError", async () => {
    await assert.rejects(
      () => pollHistory(BASE, "p-x", { fetchImpl: fetchOk(500, "boom"), intervalMs: 1, timeoutMs: 5_000 }),
      HttpError,
    );
  });

  it("downloadImage should GET /view with filename/subfolder/type and return bytes", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const impl = fetchOk(200, png.buffer, { "Content-Type": "image/png" });

    const bytes = await downloadImage(
      BASE,
      { filename: "nd-body-map-00001.png", subfolder: "", type: "output" },
      { fetchImpl: impl },
    );

    assert.deepEqual(new Uint8Array(bytes), png);
    assert.match(impl.calls[0].url, /\/view\?/);
    assert.match(impl.calls[0].url, /filename=nd-body-map-00001\.png/);
    assert.match(impl.calls[0].url, /type=output/);
  });

  it("downloadImage should map a 404 to HttpError", async () => {
    await assert.rejects(
      () => downloadImage(BASE, { filename: "gone.png" }, { fetchImpl: fetchOk(404, "not found") }),
      /404/,
    );
  });
});
