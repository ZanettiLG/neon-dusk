import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { authRoutes } from "./auth";
import { characterRoutes } from "./characters";
import { chromeRoutes } from "./chrome";
import { economyRoutes } from "./economy";
import { vendorRoutes } from "./vendors";
import { gigRoutes } from "./gigs";
import { streetCredRoutes } from "./street-cred";
import { pvpRoutes } from "./pvp";
import { saideiraRoutes } from "./saideira";
import { crewRoutes } from "./crews";
import { roundRoutes } from "./round";
import { adminMetricsRoutes } from "../telemetry/admin-metrics";
import { adminRoutes } from "./admin";
import { abilitiesRoutes } from "./abilities";
import { osRoutes } from "./os";
import { humanityRoutes } from "./humanity";
import { therapyRoutes } from "./therapy";
import { consumableRoutes } from "./consumables";
import { metroRoutes } from "./metro";

export interface ApiRoutesOptions {
  redis: Redis;
}

// Route aggregator — register every feature route module here, prefixed with /api
export async function apiRoutes(app: FastifyInstance, opts: ApiRoutesOptions) {
  await app.register(authRoutes, { redis: opts.redis });
  await app.register(characterRoutes, { redis: opts.redis });
  await app.register(economyRoutes);
  await app.register(vendorRoutes);
  await app.register(chromeRoutes);
  await app.register(gigRoutes);
  await app.register(streetCredRoutes, { redis: opts.redis });
  await app.register(pvpRoutes, { redis: opts.redis });
  await app.register(saideiraRoutes, { redis: opts.redis });
  await app.register(crewRoutes, { redis: opts.redis });
  await app.register(roundRoutes, { redis: opts.redis });
  // Admin telemetry digest — /api/admin/metrics (x-api-key protected)
  await app.register(adminMetricsRoutes);
  // Admin panel — /api/admin/* (JWT role protected, ND-052)
  await app.register(adminRoutes);
  // Role abilities — /api/abilities/*
  await app.register(abilitiesRoutes);
  // OS (issue #28) — /api/os/*
  await app.register(osRoutes);
  // Humanidade (issue #28) — /api/humanity
  await app.register(humanityRoutes);
  // Terapia (issue #28) — /api/therapy
  await app.register(therapyRoutes);
  // Itens anti-insanidade (issue #28) — /api/consumables
  await app.register(consumableRoutes);
  // Mapa do metrô (issue #18) — /api/metro
  await app.register(metroRoutes);
}
