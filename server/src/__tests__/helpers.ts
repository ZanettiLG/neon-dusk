import type { FastifyInstance } from "fastify";
import type { AddressInfo } from "node:net";
import type { AuthResponse, Role, Origin } from "@neon-dusk/shared";
import { db } from "../db";

// supertest is incompatible with Fastify 5 + @fastify/rate-limit (crashes in
// Fastify's internal preParsing hook execution — see test-report). Tests use a
// real HTTP server + native fetch instead.
export async function startTestServer(app: FastifyInstance) {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = (app.server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  return {
    port,
    get(path: string, headers?: Record<string, string>) {
      return fetch(`${base}${path}`, {
        headers: headers ?? {},
      });
    },
    post(path: string, body?: unknown, headers?: Record<string, string>) {
      // Content-Type is only set when a body exists: Fastify rejects a JSON
      // content-type with an empty body (e.g. bodyless POSTs like crew join).
      return fetch(`${base}${path}`, {
        method: "POST",
        headers:
          body === undefined ? { ...headers } : { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
  };
}

export type TestServer = Awaited<ReturnType<typeof startTestServer>>;

// Response.json() returns `unknown` under @types/node — cast to the shape
// tests assert on so strict typecheck passes at call sites.
export async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export interface HealthBody {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  services: { database: string; redis: string };
}

/** Bearer auth header for the given access token. */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/** Wipe account + economy data so test runs are repeatable regardless of order. */
export async function resetDb(): Promise<void> {
  // Issue #28 tables are listed explicitly (they cascade from `characters`
  // anyway, but the intent is documented): therapy_sessions, the consumable
  // inventory and the usage log. The `consumables` catalog is seeded data and
  // survives (same as chrome_definitions).
  const truncate = () =>
    db.raw(
      "TRUNCATE TABLE users, characters, vendors, loot_tables, therapy_sessions, character_consumables, consumable_uses CASCADE",
    );

  let attempt = 0;
  for (;;) {
    try {
      await truncate();
      return;
    } catch (err) {
      // 40P01: a previous test's fire-and-forget audit_log INSERT can still be
      // in-flight (ROW EXCLUSIVE on audit_log + FK KEY SHARE on characters)
      // when this TRUNCATE CASCADE runs, deadlocking transiently. Retry with
      // backoff until the competing write settles. If PostgreSQL picks the
      // audit INSERT as victim instead, it is harmless (auditLog .catch swallows).
      const code = (err as { code?: string }).code;
      const isDeadlock =
        code === "40P01" ||
        (err instanceof Error && err.message.includes("deadlock"));
      if (!isDeadlock) throw err;
      if (attempt >= 2) throw err; // exhausted — let it surface
      await new Promise((resolve) => setTimeout(resolve, 50 * Math.pow(2, attempt)));
      attempt += 1;
    }
  }
}

/**
 * Reset round lifecycle state (ND-017): truncate rounds + round_stats and
 * re-seed round 1 as active. `resetDb` deliberately does NOT touch rounds —
 * the migration-seeded round must survive for other suites — so round tests
 * call this instead. Legends are untouched (permanent hall of fame).
 */
export async function resetRounds(): Promise<void> {
  await db.raw("TRUNCATE TABLE rounds, round_stats CASCADE");
  await db("rounds").insert({ round_number: 1, started_at: new Date() });
}

/**
 * Insert a user + character directly into the DB (bypasses the HTTP API) and
 * return the ids. Attribute spread sums to 22 (3 base x 5 + 7 free).
 */
export async function insertTestCharacter(opts?: {
  email?: string;
  name?: string;
  role?: Role;
  origin?: Origin;
}): Promise<{ userId: string; characterId: string }> {
  const email = opts?.email ?? `svc-${Date.now()}-${Math.random().toString(36).slice(2)}@neondusk.test`;
  const name = opts?.name ?? `Corredor-${Math.random().toString(36).slice(2, 10)}`;

  const [user] = await db("users")
    .insert({ email, password_hash: "test-hash" })
    .returning("id");

  const [character] = await db("characters")
    .insert({
      user_id: user.id,
      name,
      origin: opts?.origin ?? "a_paraiso",
      role: opts?.role ?? "bicho",
      body: 5,
      reflexes: 4,
      intelligence: 4,
      technical: 4,
      cool: 5,
    })
    .returning("id");

  return { userId: user.id, characterId: character.id };
}

/** Register a fresh account and return the token pair + user. */
export async function registerTestUser(
  server: TestServer,
  email: string,
  password = "Password123",
): Promise<AuthResponse> {
  const res = await server.post("/api/auth/register", { email, password });
  if (res.status !== 201) {
    throw new Error(`registerTestUser failed: ${res.status} ${await res.text()}`);
  }
  return json<AuthResponse>(res);
}
