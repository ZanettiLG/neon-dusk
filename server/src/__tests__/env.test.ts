import { describe, it, expect, beforeEach } from "vitest";
import { envSchema, type Env } from "../env";

const ORIGINAL_ENV = { ...process.env };

function unsetEnvKeys() {
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("NODE_ENV") ||
      key.startsWith("PORT") ||
      key.startsWith("HOST") ||
      key.startsWith("LOG_LEVEL") ||
      key.startsWith("DATABASE_URL") ||
      key.startsWith("REDIS_URL") ||
      key.startsWith("RATE_LIMIT") ||
      key.startsWith("JWT") ||
      key.startsWith("ADMIN") ||
      key.startsWith("CORS_ORIGIN")
    ) {
      delete process.env[key];
    }
  }
}

describe("env schema", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    unsetEnvKeys();
    // Required keys without defaults — set them explicitly so these tests
    // don't implicitly depend on whatever setup.ts happens to provide.
    process.env.JWT_SECRET = "x".repeat(32);
    process.env.JWT_REFRESH_SECRET = "x".repeat(32);
    process.env.ADMIN_API_KEY = "x".repeat(32);
  });

  it("should apply default values when env vars are missing", () => {
    const env = envSchema.parse(process.env);

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
    expect(env.HOST).toBe("0.0.0.0");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.DATABASE_URL).toBe("postgres://neondusk:neondusk_dev@localhost:5432/neondusk");
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
    expect(env.RATE_LIMIT_MAX).toBe(10000);
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(env.CORS_ORIGIN).toBe("http://localhost:5173");
  });

  it("should coerce numeric strings into numbers", () => {
    process.env.PORT = "8080";
    process.env.RATE_LIMIT_MAX = "50";
    process.env.RATE_LIMIT_WINDOW_MS = "30000";

    const env = envSchema.parse(process.env);
    expect(env.PORT).toBe(8080);
    expect(env.RATE_LIMIT_MAX).toBe(50);
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(30000);
  });

  it("should reject invalid PORT (non-numeric)", () => {
    process.env.PORT = "abc";
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(false);
  });

  it("should reject non-positive PORT", () => {
    process.env.PORT = "-1";
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(false);
  });

  it("should reject invalid LOG_LEVEL", () => {
    process.env.LOG_LEVEL = "loud";
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(false);
  });

  it("should reject invalid DATABASE_URL", () => {
    process.env.DATABASE_URL = "not-a-url";
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(false);
  });

  it("should produce an Env-typed object", () => {
    const env = envSchema.parse(process.env) as Env;
    expect(env).toHaveProperty("PORT");
    expect(env).toHaveProperty("DATABASE_URL");
  });

  it("should reject a missing ADMIN_API_KEY", () => {
    delete process.env.ADMIN_API_KEY;
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(false);
  });

  it("should reject an ADMIN_API_KEY shorter than 32 characters", () => {
    process.env.ADMIN_API_KEY = "x".repeat(31);
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(false);
  });

  it("should accept an ADMIN_API_KEY with 32 or more characters", () => {
    process.env.ADMIN_API_KEY = "x".repeat(32);
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(true);
  });
});
