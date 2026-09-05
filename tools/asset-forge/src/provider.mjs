/* global AbortSignal, URL, URLSearchParams, setTimeout */
/**
 * ComfyUI HTTP client (local headless server). Surface is exactly the five
 * endpoints used by the generate flow:
 *
 *   GET  /system_stats                        → health check
 *   GET  /object_info/CheckpointLoaderSimple  → checkpoint validation
 *   POST /prompt                              → submit workflow
 *   GET  /history/{prompt_id}                 → poll status + outputs
 *   GET  /view?filename=&subfolder=&type=     → download rendered PNG
 *
 * `fetchImpl` is injectable (default: globalThis.fetch) so tests stub it with
 * zero network. Connection failures map to ComfyOfflineError; non-2xx and
 * malformed bodies to HttpError; failed generations to GenerationError.
 */

import { ComfyOfflineError, HttpError, GenerationError, TimeoutError } from "./errors.mjs";

const CONNECTION_TIMEOUT_MS = 2_000;
const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 120_000;

/**
 * Fetch with a hard timeout; rejections become ComfyOfflineError.
 * @private
 */
async function request(url, options, { fetchImpl = globalThis.fetch, timeoutMs } = {}) {
  let res;
  try {
    res = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    // AbortSignal.timeout fires on connect/read stall — same treatment as a
    // refused connection: the server is unreachable.
    throw new ComfyOfflineError(new URL(url).origin, err);
  }
  return res;
}

/** @private Read the body as text, tolerating empty/non-UTF8 responses. */
async function bodyText(res) {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

/**
 * Health check: GET /system_stats.
 * @param {string} baseUrl e.g. "http://127.0.0.1:8188"
 * @param {{fetchImpl?: Function, timeoutMs?: number}} [opts]
 * @returns {Promise<object>} parsed stats JSON
 * @throws {ComfyOfflineError} server unreachable
 * @throws {HttpError} non-2xx answer
 */
export async function checkServer(baseUrl, opts = {}) {
  const res = await request(
    `${baseUrl}/system_stats`,
    { method: "GET" },
    {
      fetchImpl: opts.fetchImpl,
      timeoutMs: opts.timeoutMs ?? CONNECTION_TIMEOUT_MS,
    },
  );
  if (!res.ok) throw new HttpError(res.status, await bodyText(res));
  return res.json();
}

/**
 * Validate that CHECKPOINT exists on the server (GET /object_info).
 * @param {string} baseUrl
 * @param {string} checkpoint checkpoint name (prefix match against installed files)
 * @param {{fetchImpl?: Function}} [opts]
 * @throws {ComfyOfflineError | HttpError | GenerationError} offline / HTTP / checkpoint absent
 */
export async function checkCheckpoint(baseUrl, checkpoint, opts = {}) {
  const res = await request(
    `${baseUrl}/object_info/CheckpointLoaderSimple`,
    { method: "GET" },
    {
      fetchImpl: opts.fetchImpl,
      timeoutMs: CONNECTION_TIMEOUT_MS,
    },
  );
  if (!res.ok) throw new HttpError(res.status, await bodyText(res));
  const info = (await res.json())?.CheckpointLoaderSimple;
  const names = info?.input?.required?.ckpt_name?.[0];
  if (!Array.isArray(names) || !names.some((name) => String(name).startsWith(checkpoint))) {
    throw new GenerationError(`Checkpoint "${checkpoint}" não encontrado no ComfyUI (${baseUrl})`);
  }
}

/**
 * Submit a workflow (POST /prompt).
 * @param {string} baseUrl
 * @param {object} workflow from buildWorkflow
 * @param {{fetchImpl?: Function}} [opts]
 * @returns {Promise<string>} prompt_id
 * @throws {ComfyOfflineError | HttpError} offline / non-2xx / body without prompt_id
 */
export async function submitWorkflow(baseUrl, workflow, opts = {}) {
  const res = await request(
    `${baseUrl}/prompt`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    },
    { fetchImpl: opts.fetchImpl, timeoutMs: CONNECTION_TIMEOUT_MS },
  );
  if (!res.ok) throw new HttpError(res.status, await bodyText(res));
  const body = await res.json().catch(() => null);
  if (typeof body?.prompt_id !== "string" || body.prompt_id.length === 0) {
    throw new HttpError(
      res.status,
      `POST /prompt sem prompt_id: ${JSON.stringify(body).slice(0, 200)}`,
    );
  }
  return body.prompt_id;
}

/** @private Best-effort error message from a ComfyUI history status block. */
function statusMessage(status) {
  const fromMessages = (status?.messages ?? [])
    .map((m) => (Array.isArray(m) ? m[1] : m))
    .filter((m) => typeof m === "string")
    .join("; ");
  return fromMessages || `status_str=${status?.status_str ?? "unknown"}`;
}

/**
 * Poll GET /history/{promptId} until completed or failed.
 * @param {string} baseUrl
 * @param {string} promptId id returned by submitWorkflow
 * @param {{fetchImpl?: Function, timeoutMs?: number, intervalMs?: number}} [opts]
 * @returns {Promise<{filename: string, subfolder: string, type: string}>} first output image
 * @throws {ComfyOfflineError | HttpError | GenerationError | TimeoutError}
 */
export async function pollHistory(baseUrl, promptId, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? POLL_TIMEOUT_MS;
  const intervalMs = opts.intervalMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const res = await request(
      `${baseUrl}/history/${encodeURIComponent(promptId)}`,
      { method: "GET" },
      {
        fetchImpl: opts.fetchImpl,
        timeoutMs: CONNECTION_TIMEOUT_MS,
      },
    );
    if (!res.ok) throw new HttpError(res.status, await bodyText(res));
    const entry = (await res.json().catch(() => null))?.[promptId];

    if (entry) {
      if (entry.status?.status_str === "error") {
        throw new GenerationError(`ComfyUI falhou na geração: ${statusMessage(entry.status)}`);
      }
      if (entry.status?.completed) {
        const outputs = Object.values(entry.outputs ?? {});
        const images = outputs.find((o) => Array.isArray(o.images))?.images ?? [];
        if (images.length === 0) {
          throw new GenerationError("history completed mas sem imagens em outputs");
        }
        return images[0];
      }
    }

    if (Date.now() >= deadline) throw new TimeoutError(timeoutMs);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Download a rendered image (GET /view).
 * @param {string} baseUrl
 * @param {{filename: string, subfolder?: string, type?: string}} image from pollHistory
 * @param {{fetchImpl?: Function}} [opts]
 * @returns {Promise<ArrayBuffer>} PNG bytes
 * @throws {ComfyOfflineError | HttpError}
 */
export async function downloadImage(baseUrl, image, opts = {}) {
  const params = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder ?? "",
    type: image.type ?? "output",
  });
  const res = await request(
    `${baseUrl}/view?${params}`,
    { method: "GET" },
    {
      fetchImpl: opts.fetchImpl,
      timeoutMs: POLL_TIMEOUT_MS,
    },
  );
  if (!res.ok) throw new HttpError(res.status, await bodyText(res));
  return res.arrayBuffer();
}
