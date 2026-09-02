import { parseCorsOrigins, type Env } from "../env";

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
 * Returns a factory that echoes the REQUEST's origin when it is on the allowed
 * list (ND-018 multi-origin CORS_ORIGIN), falling back to the first allowed
 * origin otherwise — mirrors the @fastify/cors registration in app.ts
 * (origin: corsOrigins, credentials: true); keep both in sync.
 */
export function sseCorsHeaders(env: Env): (origin?: string) => Record<string, string> {
  const allowed = parseCorsOrigins(env.CORS_ORIGIN);

  return (origin) => {
    const allowOrigin = origin && allowed.includes(origin) ? origin : (allowed[0] ?? "*");
    // Access-Control-Allow-Credentials: true with Allow-Origin: * is rejected
    // by browsers — only send it when echoing a concrete origin.
    return {
      "Access-Control-Allow-Origin": allowOrigin,
      ...(allowOrigin !== "*"
        ? { Vary: "Origin", "Access-Control-Allow-Credentials": "true" }
        : {}),
    };
  };
}
