import type { FastifyInstance } from "fastify";
import type { AddressInfo } from "node:net";

// supertest is incompatible with Fastify 5 + @fastify/rate-limit (crashes in
// Fastify's internal preParsing hook runner — see test-report). Tests use a
// real HTTP server + native fetch instead.
export async function startTestServer(app: FastifyInstance) {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = (app.server.address() as AddressInfo).port;
  return {
    port,
    get(path: string) {
      return fetch(`http://127.0.0.1:${port}${path}`);
    },
  };
}

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
