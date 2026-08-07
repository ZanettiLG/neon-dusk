import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  ChromeInstallResponse,
  ChromeUninstallResponse,
  InstalledChromeResponse,
} from "@neon-dusk/shared";
import { CHROME_SLOTS } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { requireCharacterId } from "../services/economy-service";
import {
  installChrome,
  listChromeCatalog,
  listInstalledChrome,
  uninstallChrome,
} from "../services/chrome-service";

// Neon Dusk — Chrome routes (catalog, loadout, install, uninstall)
// ============================================================================
// All endpoints resolve the caller's character from their JWT sub claim.
// Install/uninstall are the only mutating endpoints and run atomically inside
// the chrome service's transactions.

export async function chromeRoutes(app: FastifyInstance) {
  // GET /api/chrome — active catalog, optionally filtered by tier/slot
  app.get("/chrome", { preHandler: [authenticate] }, async (request) => {
    const querySchema = z.object({
      tier: z.coerce.number().int().min(1).max(5).optional(),
      slot: z.enum(CHROME_SLOTS).optional(),
    });
    const query = querySchema.parse(request.query);
    return listChromeCatalog(query);
  });

  // GET /api/chrome/installed — player's loadout + effective bonuses
  app.get("/chrome/installed", { preHandler: [authenticate] }, async (request) => {
    const characterId = await requireCharacterId(request.user.sub);
    return listInstalledChrome(characterId) as Promise<InstalledChromeResponse>;
  });

  // POST /api/chrome/install — buy + implant a chrome from a ripperdoc
  app.post("/chrome/install", { preHandler: [authenticate] }, async (request, reply) => {
    const bodySchema = z.object({
      chromeDefinitionId: z.string().uuid(),
      vendorId: z.string().uuid(),
    });
    const body = bodySchema.parse(request.body);

    const characterId = await requireCharacterId(request.user.sub);
    const result = await installChrome(characterId, body.chromeDefinitionId, body.vendorId);
    return reply.status(201).send(result as ChromeInstallResponse);
  });

  // POST /api/chrome/uninstall — remove an implant (no refund, no humanity back)
  app.post("/chrome/uninstall", { preHandler: [authenticate] }, async (request) => {
    const bodySchema = z.object({
      installedChromeId: z.string().uuid(),
    });
    const body = bodySchema.parse(request.body);

    const characterId = await requireCharacterId(request.user.sub);
    return uninstallChrome(characterId, body.installedChromeId) as Promise<ChromeUninstallResponse>;
  });
}
