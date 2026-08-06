import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { healthRoutes } from "./health";
import { authRoutes } from "./auth";
import { characterRoutes } from "./characters";
import { luckyChipRoutes } from "./lucky-chip";

export interface ApiRoutesOptions {
  redis: Redis;
}

// Route aggregator — register every feature route module here, prefixed with /api
export async function apiRoutes(app: FastifyInstance, opts: ApiRoutesOptions) {
  await app.register(healthRoutes, { redis: opts.redis });
  await app.register(authRoutes, { redis: opts.redis });
  await app.register(characterRoutes, { redis: opts.redis });
  await app.register(luckyChipRoutes, { redis: opts.redis });
}
