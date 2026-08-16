import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader } from "./helpers";
import { db } from "../db";
import type { AuthResponse, UserWithCharacter } from "@neon-dusk/shared";

// Feature #1 — account API integration tests. Each `it` performs a real HTTP
// request against the app under test (Fastify + Postgres + Redis on the
// isolated test stack). Emails are unique per call so runs never collide.
//
// The app points its rate-limit counters at a dedicated redis db (2) that is
// flushed before the run — like rate-limit.test.ts does with db 1 — so the
// global per-IP 100/min budget is never shared with the other test files.

const REDIS_TEST_DB = "redis://localhost:56379/2";

const PASSWORD = "StrongPass123!";

let emailSeq = 0;
function uniqueEmail(): string {
  return `runner-${Date.now()}-${emailSeq++}@neondusk.test`;
}

interface ErrorBody {
  error: string;
  message: string;
  details?: { path: (string | number)[]; message: string }[];
}

describe("Feature #1 — auth API", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;

  let redis: Redis;

  beforeAll(async () => {
    // Fresh counters on the dedicated db so repeated runs within a window
    // never trip the global rate limit (and the 429 tests are deterministic).
    redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();

    app = await buildApp({ env: envSchema.parse({ ...process.env, REDIS_URL: REDIS_TEST_DB }) });
    server = await startTestServer(app);
  });

  afterAll(async () => {
    redis.disconnect();
    await app.close();
  });

  /** Register a fresh account and return the token pair + user. */
  async function registerAndGetTokens(email: string): Promise<AuthResponse> {
    const res = await server.post("/api/auth/register", { email, password: PASSWORD });
    expect(res.status).toBe(201);
    return json<AuthResponse>(res);
  }

  describe("POST /api/auth/register", () => {
    it("should register a new user and return tokens with a null character", async () => {
      const email = uniqueEmail();
      const res = await server.post("/api/auth/register", { email, password: PASSWORD });

      expect(res.status).toBe(201);
      const body = await json<AuthResponse>(res);
      expect(body.user.email).toBe(email);
      expect(body.accessToken).toBeTruthy();
      expect(body.refreshToken).toBeTruthy();
      expect(body.character).toBeNull();
    });

    it("should return 409 when the email is already registered (case-insensitive)", async () => {
      const email = uniqueEmail();
      await registerAndGetTokens(email);

      const res = await server.post("/api/auth/register", {
        email: email.toUpperCase(),
        password: PASSWORD,
      });

      expect(res.status).toBe(409);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("EMAIL_TAKEN");
    });

    it("should persist a bcrypt password_hash (never plaintext) for the new user", async () => {
      const email = uniqueEmail();
      const res = await server.post("/api/auth/register", { email, password: PASSWORD });
      expect(res.status).toBe(201);
      const body = await json<AuthResponse>(res);

      // Direct DB read — the users row must carry a hash, not the plaintext.
      const [row] = await db("users")
        .select("password_hash")
        .where("id", body.user.id)
        .limit(1);
      expect(row).toBeDefined();
      expect(row.password_hash).toBeTruthy();
      expect(row.password_hash).not.toBe(PASSWORD);
      // bcrypt format: $2b$<rounds>$<53-char salt+hash> (60 chars total).
      expect(row.password_hash).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
      // And it verifies against the known password (bcrypt round-trip).
      expect(await bcrypt.compare(PASSWORD, row.password_hash)).toBe(true);
    });

    it("should return 400 with a validation error for an invalid email", async () => {
      const res = await server.post("/api/auth/register", {
        email: "not-an-email",
        password: PASSWORD,
      });

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
      expect(body.details?.[0]?.path).toContain("email");
    });

    it("should return 400 when the password is shorter than 8 characters", async () => {
      const res = await server.post("/api/auth/register", {
        email: uniqueEmail(),
        password: "short",
      });

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
      expect(body.details?.[0]?.path).toContain("password");
    });

    // NOTE: `confirmPassword` is not part of the backend contract — the
    // mismatch is validated client-side (see RegisterView.test.ts). The
    // backend schema is { email, password } and ignores extra fields.
    it("should return 429 when the register per-email limit is exceeded", async () => {
      // Per-email register counter (max 300/min) — pre-set via Redis to
      // avoid making 301 sequential HTTP requests.
      const email = uniqueEmail();
      const first = await server.post("/api/auth/register", { email, password: PASSWORD });
      expect(first.status).toBe(201);

      // Set the counter to 300 so the next INCR (to 301) trips the limit.
      await redis.setex("auth:rl:register:" + email, 60, 300);

      const res = await server.post("/api/auth/register", { email, password: PASSWORD });
      expect(res.status).toBe(429);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("RATE_LIMITED");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should return tokens when credentials are correct", async () => {
      const email = uniqueEmail();
      await registerAndGetTokens(email);

      const res = await server.post("/api/auth/login", { email, password: PASSWORD });

      expect(res.status).toBe(200);
      const body = await json<AuthResponse>(res);
      expect(body.user.email).toBe(email);
      expect(body.accessToken).toBeTruthy();
      expect(body.refreshToken).toBeTruthy();
      expect(body.character).toBeNull();
    });

    it("should return 401 when the password is wrong", async () => {
      const email = uniqueEmail();
      await registerAndGetTokens(email);

      const res = await server.post("/api/auth/login", { email, password: "WrongPass123!" });

      expect(res.status).toBe(401);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("INVALID_CREDENTIALS");
    });

    it("should return 401 for an unknown email (no account enumeration)", async () => {
      const res = await server.post("/api/auth/login", {
        email: uniqueEmail(),
        password: PASSWORD,
      });

      expect(res.status).toBe(401);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("INVALID_CREDENTIALS");
    });

    it("should return 429 when the login per-email limit is exceeded", async () => {
      const email = uniqueEmail();
      await registerAndGetTokens(email);

      // Set the counter to 500 (max for login) so next INCR trips the limit.
      await redis.setex("auth:rl:login:" + email, 60, 500);

      const res = await server.post("/api/auth/login", { email, password: PASSWORD });
      expect(res.status).toBe(429);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("RATE_LIMITED");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should rotate the refresh token and return a fresh pair", async () => {
      const { refreshToken } = await registerAndGetTokens(uniqueEmail());

      const res = await server.post("/api/auth/refresh", { refreshToken });

      expect(res.status).toBe(200);
      const body = await json<AuthResponse>(res);
      expect(body.accessToken).toBeTruthy();
      expect(body.refreshToken).toBeTruthy();
      expect(body.refreshToken).not.toBe(refreshToken);
    });

    it("should return 401 when the refresh token was already consumed", async () => {
      const { refreshToken } = await registerAndGetTokens(uniqueEmail());
      const first = await server.post("/api/auth/refresh", { refreshToken });
      expect(first.status).toBe(200);

      const res = await server.post("/api/auth/refresh", { refreshToken });
      expect(res.status).toBe(401);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("INVALID_REFRESH_TOKEN");
    });

    it("should reject concurrent refresh with the same token (atomic rotation)", async () => {
      const { refreshToken } = await registerAndGetTokens(uniqueEmail());

      const [res1, res2] = await Promise.all([
        fetch(`http://127.0.0.1:${server.port}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        }),
        fetch(`http://127.0.0.1:${server.port}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 401]);
      const loser = res1.status === 200 ? res2 : res1;
      const body = await json<ErrorBody>(loser);
      expect(body.error).toBe("INVALID_REFRESH_TOKEN");
    });

    it("should return 401 for a random unknown refresh token", async () => {
      const res = await server.post("/api/auth/refresh", { refreshToken: randomUUID() });

      expect(res.status).toBe(401);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("INVALID_REFRESH_TOKEN");
    });

    it("should return 400 when the token is not a uuid", async () => {
      const res = await server.post("/api/auth/refresh", { refreshToken: "not-a-uuid" });

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should revoke the refresh token and return 204", async () => {
      const { refreshToken } = await registerAndGetTokens(uniqueEmail());

      const res = await server.post("/api/auth/logout", { refreshToken });

      expect(res.status).toBe(204);
    });

    it("should be idempotent for an already-revoked token", async () => {
      const res = await server.post("/api/auth/logout", { refreshToken: randomUUID() });

      expect(res.status).toBe(204);
    });

    it("should return 400 when the body has no refresh token", async () => {
      // Logout has no auth middleware — it requires a valid uuid body only.
      const res = await server.post("/api/auth/logout", {});

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return the authenticated user with a null character", async () => {
      const email = uniqueEmail();
      const { accessToken } = await registerAndGetTokens(email);

      const res = await fetch(`http://127.0.0.1:${server.port}/api/auth/me`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<UserWithCharacter>(res);
      expect(body.user.email).toBe(email);
      expect(body.character).toBeNull();
    });

    it("should return 401 without an access token", async () => {
      const res = await server.get("/api/auth/me");

      expect(res.status).toBe(401);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("should return 401 with a garbage access token", async () => {
      const res = await fetch(`http://127.0.0.1:${server.port}/api/auth/me`, {
        headers: authHeader("garbage-token"),
      });

      expect(res.status).toBe(401);
    });
  });
});
