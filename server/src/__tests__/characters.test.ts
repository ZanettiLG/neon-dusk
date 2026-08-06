import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader } from "./helpers";
import type { AuthResponse, Character, CreateCharacterRequest, UserWithCharacter } from "@neon-dusk/shared";

// Feature #1 — character creation API integration tests. Names are unique per
// run (like emails) so leftover rows from previous runs never flip a 201 into
// a 409. The app's rate-limit counters live on a dedicated redis db (3) that
// is flushed before the run (see auth.test.ts for the rationale).

const REDIS_TEST_DB = "redis://localhost:56379/3";

const PASSWORD = "StrongPass123!";

let seq = 0;
function uniqueEmail(): string {
  return `runner-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Ghost-${Date.now()}-${seq++}`;
}

/** Valid attribute spread: 3 base × 5 + 7 free points = 22. */
function validAttributes(): CreateCharacterRequest["attributes"] {
  return { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 };
}

interface ErrorBody {
  error: string;
  message: string;
  details?: { path: (string | number)[]; message: string }[];
}

describe("Feature #1 — characters API", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;
  const base = () => `http://127.0.0.1:${server.port}`;

  beforeAll(async () => {
    const redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();
    redis.disconnect();

    app = await buildApp({ env: envSchema.parse({ ...process.env, REDIS_URL: REDIS_TEST_DB }) });
    server = await startTestServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Register a fresh account and return the token pair + user. */
  async function registerAndGetTokens(email: string): Promise<AuthResponse> {
    const res = await server.post("/api/auth/register", { email, password: PASSWORD });
    expect(res.status).toBe(201);
    return json<AuthResponse>(res);
  }

  function createCharacter(
    accessToken: string,
    body: CreateCharacterRequest,
  ): Promise<Response> {
    return fetch(`${base()}/api/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
      body: JSON.stringify(body),
    });
  }

  describe("POST /api/characters", () => {
    it("should create a character with 22 attribute points", async () => {
      const { accessToken } = await registerAndGetTokens(uniqueEmail());

      const res = await createCharacter(accessToken, {
        name: uniqueName(),
        origin: "a_paraiso",
        role: "solo",
        attributes: validAttributes(),
      });

      expect(res.status).toBe(201);
      const body = await json<Character>(res);
      expect(body.id).toBeTruthy();
      expect(body.userId).toBeTruthy();
      expect(body.name).toMatch(/^Ghost-/);
      expect(body.origin).toBe("a_paraiso");
      expect(body.role).toBe("solo");
      expect(body).toMatchObject(validAttributes());
      expect(typeof body.createdAt).toBe("string");
      expect(typeof body.updatedAt).toBe("string");
    });

    it("should return 400 when the attribute total is not 22", async () => {
      const { accessToken } = await registerAndGetTokens(uniqueEmail());

      const res = await createCharacter(accessToken, {
        name: uniqueName(),
        origin: "o_fervo",
        role: "netrunner",
        attributes: { body: 3, reflexes: 3, intelligence: 3, technical: 3, cool: 3 }, // 15
      });

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("INVALID_ATTRIBUTES");
    });

    it("should return 400 when an attribute is below 1", async () => {
      const { accessToken } = await registerAndGetTokens(uniqueEmail());

      const res = await createCharacter(accessToken, {
        name: uniqueName(),
        origin: "o_fervo",
        role: "tech",
        attributes: { body: 0, reflexes: 4, intelligence: 5, technical: 6, cool: 7 },
      });

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
      expect(body.details?.[0]?.path).toEqual(["attributes", "body"]);
    });

    it("should return 400 when an attribute is above 20", async () => {
      const { accessToken } = await registerAndGetTokens(uniqueEmail());

      const res = await createCharacter(accessToken, {
        name: uniqueName(),
        origin: "o_fervo",
        role: "fixer",
        attributes: { body: 21, reflexes: 0, intelligence: 0, technical: 0, cool: 1 },
      });

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
      expect(body.details?.[0]?.path).toEqual(["attributes", "body"]);
    });

    it("should return 409 when the name is taken (case-insensitive)", async () => {
      const name = uniqueName();
      const first = await registerAndGetTokens(uniqueEmail());
      const created = await createCharacter(first.accessToken, {
        name,
        origin: "a_paraiso",
        role: "solo",
        attributes: validAttributes(),
      });
      expect(created.status).toBe(201);

      const second = await registerAndGetTokens(uniqueEmail());
      const res = await createCharacter(second.accessToken, {
        name: name.toLowerCase(),
        origin: "a_paraiso",
        role: "solo",
        attributes: validAttributes(),
      });

      expect(res.status).toBe(409);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("NAME_TAKEN");
    });

    it("should return 409 when the user already has a character", async () => {
      const { accessToken } = await registerAndGetTokens(uniqueEmail());
      const created = await createCharacter(accessToken, {
        name: uniqueName(),
        origin: "a_paraiso",
        role: "solo",
        attributes: validAttributes(),
      });
      expect(created.status).toBe(201);

      const res = await createCharacter(accessToken, {
        name: uniqueName(),
        origin: "o_fluxo",
        role: "nomad",
        attributes: validAttributes(),
      });

      expect(res.status).toBe(409);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("CHARACTER_EXISTS");
    });

    it("should return 401 without an access token", async () => {
      const res = await server.post("/api/characters", {
        name: uniqueName(),
        origin: "a_paraiso",
        role: "solo",
        attributes: validAttributes(),
      });

      expect(res.status).toBe(401);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/auth/me after character creation", () => {
    it("should return the created character in the session", async () => {
      const email = uniqueEmail();
      const { accessToken } = await registerAndGetTokens(email);
      const name = uniqueName();

      await createCharacter(accessToken, {
        name,
        origin: "a_paraiso",
        role: "solo",
        attributes: validAttributes(),
      });

      const res = await fetch(`${base()}/api/auth/me`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<UserWithCharacter>(res);
      expect(body.user.email).toBe(email);
      expect(body.character).not.toBeNull();
      expect(body.character?.name).toBe(name);
    });
  });
});
