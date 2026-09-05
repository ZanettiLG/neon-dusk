/**
 * Error taxonomy for asset-forge. Each class maps to a CLI exit code (see
 * cli.mjs EXIT table): offline → 3, HTTP/generation → 4, timeout → 5,
 * registry/usage → 2, unexpected → 1.
 */

/** ComfyUI server unreachable (ECONNREFUSED, DNS, connection timeout). */
export class ComfyOfflineError extends Error {
  /**
   * @param {string} baseUrl base URL of the unreachable server
   * @param {unknown} [cause] original fetch error, kept for debugging
   */
  constructor(baseUrl, cause) {
    super(`ComfyUI offline em ${baseUrl}`);
    this.name = "ComfyOfflineError";
    this.cause = cause;
  }
}

/** ComfyUI answered with a non-2xx status or a malformed body. */
export class HttpError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} body response body (truncated by the caller)
   */
  constructor(status, body) {
    super(`ComfyUI respondeu HTTP ${status}${body ? `: ${body}` : ""}`);
    this.name = "HttpError";
    this.status = status;
  }
}

/** Workflow submitted but ComfyUI reported a generation failure. */
export class GenerationError extends Error {
  /** @param {string} message ComfyUI error message (or our summary) */
  constructor(message) {
    super(message);
    this.name = "GenerationError";
  }
}

/** Generation did not finish within the configured timeout. */
export class TimeoutError extends Error {
  /** @param {number} timeoutMs configured timeout */
  constructor(timeoutMs) {
    super(`Geração não completou em ${Math.round(timeoutMs / 1000)}s`);
    this.name = "TimeoutError";
  }
}

/** registry.json is missing, malformed or fails schema validation. */
export class RegistryError extends Error {
  /** @param {string} message validation detail */
  constructor(message) {
    super(`Registry inválido: ${message}`);
    this.name = "RegistryError";
  }
}

/** Unknown command, unknown asset type or invalid CLI flag. */
export class UsageError extends Error {
  /** @param {string} message usage detail */
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}
