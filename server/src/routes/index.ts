import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { healthRoutes } from "./health";
import { authRoutes } from "./auth";
import { characterRoutes } from "./characters";
import { chromeRoutes } from "./chrome";
import { economyRoutes } from "./economy";
import { vendorRoutes } from "./vendors";
import { gigRoutes } from "./gigs";
import { streetCredRoutes } from "./street-cred";
import { pvpRoutes } from "./pvp";
import { saideiraRoutes } from "./saideira";
import { adminMetricsRoutes } from "../telemetry/admin-metrics";

export interface ApiRoutesOptions {
  redis: Redis;
}

// Route aggregator — register every feature route module here, prefixed with /api
export async function apiRoutes(app: FastifyInstance, opts: ApiRoutesOptions) {
  await app.register(healthRoutes, { redis: opts.redis });
  await app.register(authRoutes, { redis: opts.redis });
  await app.register(characterRoutes, { redis: opts.redis });
  await app.register(economyRoutes);
  await app.register(vendorRoutes);
  await app.register(chromeRoutes);
  await app.register(gigRoutes);
  await app.register(streetCredRoutes, { redis: opts.redis });
  await app.register(pvpRoutes, { redis: opts.redis });
  await app.register(saideiraRoutes, { redis: opts.redis });
  // Admin telemetry digest — /api/admin/metrics (x-api-key protected)
  await app.register(adminMetricsRoutes);
}
