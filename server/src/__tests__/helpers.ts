import type { FastifyInstance } from "fastify";
import type { AddressInfo } from "node:net";
import { sql } from "drizzle-orm";
import type { AuthResponse } from "@neon-dusk/shared";
import { db } from "../db";

// supertest is incompatible with Fastify 5 + @fastify/rate-limit (crashes in
// Fastify's internal preParsing hook runner — see test-report). Tests use a
// real HTTP server + native fetch instead.
export async function startTestServer(app: FastifyInstance) {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = (app.server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  return {
    port,
    get(path: string) {
      return fetch(`${base}${path}`);
    },
    post(path: string, body?: unknown, headers?: Record<string, string>) {
      return fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
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

/** Wipe account data so test runs are repeatable regardless of order. */
export async function resetDb(): Promise<void> {
  // Lucky Chip tables (ND-008) have no FK to characters (disposable feature),
  // so CASCADE from `characters` doesn't reach them — truncate explicitly.
  await db.execute(
    sql`TRUNCATE TABLE users, characters, character_eddie_balances, lucky_chip_bets CASCADE`,
  );
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
