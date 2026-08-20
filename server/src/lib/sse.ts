import type { Env } from "../env";

/**
 * CORS headers for hijacked SSE responses (ADR-1).
 *
 * @fastify/cors applies its headers via reply.header() in the onRequest hook —
 * those land in Fastify's internal header map and only reach the wire when
 * reply.send() serializes the response. SSE endpoints call
 * reply.raw.writeHead() + reply.hijack(), so the plugin's headers never reach
 * the wire and cross-origin EventSource connections fail the CORS check
 * (chat stuck "reconectando...").
 *
 * Mirrors the cors registration in app.ts (origin: env.CORS_ORIGIN,
 * credentials: true) — keep both in sync when the CORS config changes.
 */
export function sseCorsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN,
    ...(env.CORS_ORIGIN !== "*" ? { Vary: "Origin" } : {}),
    "Access-Control-Allow-Credentials": "true",
  };
}
