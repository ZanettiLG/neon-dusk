import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENV_FILE_PATH, loadDotenv } from "../env";

const SENTINEL_KEY = "ND_ENV_PATH_TEST_SENTINEL";
const PRECEDENCE_SENTINEL_KEY = "ND_ENV_PRECEDENCE_SENTINEL";

describe("ENV_FILE_PATH", () => {
  it("should be an absolute path resolving to <repo>/server/.env", () => {
    expect(isAbsolute(ENV_FILE_PATH)).toBe(true);

    // env.ts computes `fileURLToPath(new URL("../.env", import.meta.url))`
    // from server/src/env.ts → <repo>/server/.env. This test file lives one
    // level deeper (server/src/__tests__/), so the identical physical file is
    // reached via ../../.env — both must agree on the exact path string.
    const expected = fileURLToPath(new URL("../../.env", import.meta.url));
    expect(ENV_FILE_PATH).toBe(expected);

    // Structural guard, independent of where the repo is checked out: the
    // path must land on a ".env" inside a "server" directory.
    expect(ENV_FILE_PATH).toMatch(/[\\/]server[\\/]\.env$/);
  });
});

describe("loadDotenv seam", () => {
  let tempDir = "";

  afterEach(() => {
    delete process.env[SENTINEL_KEY];
    delete process.env[PRECEDENCE_SENTINEL_KEY];
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("should load env vars from an arbitrary .env path (test seam)", () => {
    tempDir = mkdtempSync(join(tmpdir(), "nd-env-path-test-"));
    const envPath = join(tempDir, ".env");
    writeFileSync(envPath, `${SENTINEL_KEY}=ok\n`);

    // dotenv never overrides existing vars — ensure the key is unset so the
    // value provably comes from the fixture file.
    delete process.env[SENTINEL_KEY];

    const result = loadDotenv(envPath);

    expect(result.parsed?.[SENTINEL_KEY]).toBe("ok");
    expect(process.env[SENTINEL_KEY]).toBe("ok");
  });

  it("should not throw when the .env path does not exist and should report the error", () => {
    tempDir = mkdtempSync(join(tmpdir(), "nd-env-path-test-"));
    const missingPath = join(tempDir, "does-not-exist.env");

    let result: ReturnType<typeof loadDotenv>;
    expect(() => {
      result = loadDotenv(missingPath);
    }).not.toThrow();

    // dotenv@16 config() returns { parsed, error } — an empty `parsed` plus
    // the ENOENT carried from fs.readFileSync. A missing file is a no-op, not
    // a crash (server startup must never die because .env is absent in prod).
    expect(result!.parsed).toEqual({});
    expect(result!.error).toBeInstanceOf(Error);
  });

  it("should not override an existing process.env var when loading a .env file", () => {
    tempDir = mkdtempSync(join(tmpdir(), "nd-env-path-test-"));
    const envPath = join(tempDir, ".env");
    writeFileSync(envPath, `${PRECEDENCE_SENTINEL_KEY}=from-file\n`);

    // Simulate a var already injected by prod/CI: it must win over the .env
    // file. dotenv@16 defaults to `override: false`; a future flip to
    // `override: true` would silently leak .env values over injected ones —
    // this test locks the precedence guarantee in.
    process.env[PRECEDENCE_SENTINEL_KEY] = "pre-existing";

    loadDotenv(envPath);

    expect(process.env[PRECEDENCE_SENTINEL_KEY]).toBe("pre-existing");
  });
});
