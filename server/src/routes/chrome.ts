import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  ChromeInstallResponse,
  ChromeUninstallResponse,
  InstalledChromeResponse,
} from "@neon-dusk/shared";
import { CHROME_SLOTS } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { checkCircuitBreaker } from "../middleware/circuit-breaker";
import { validate } from "../middleware/validate";
import { setAuditContext } from "../middleware/audit-middleware";
import { checkActionRateLimit } from "../lib/rate-limit";
import { characterRepository as characters } from "../repositories/character-repository";
import {
  installChrome,
  listChromeCatalog,
  listInstalledChrome,
  uninstallChrome,
} from "../services/chrome-service";

// Neon Dusk — Cromo routes (catalog, loadout, install, uninstall)
// ============================================================================
// All endpoints resolve the caller's character from their JWT sub claim.
// Install/uninstall are the only mutating endpoints and run atomically inside
// the `chrome-service` transactions.
//
// ND-053: Install/uninstall are guarded by circuit-break, per-action rate
// limits, validation, and audit logging.

const installSchema = z.object({
  chromeDefinitionId: z.string().uuid(),
  vendorId: z.string().uuid(),
});

const uninstallSchema = z.object({
  installedChromeId: z.string().uuid(),
});

export async function chromeRoutes(app: FastifyInstance) {
  const redis = app.redis;

  // GET `/api/chrome` — catálogo ativo, opcionalmente filtrado por tier/slot
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
    const characterId = (await characters.requireByUserId(request.user.sub)).id;
    return listInstalledChrome(characterId) as Promise<InstalledChromeResponse>;
  });

  // POST /api/chrome/install — buy + implant a chrome from a ferrageiro
  app.post(
    "/chrome/install",
    {
      preHandler: [
        authenticate,
        setAuditContext("chrome_install"),
        checkCircuitBreaker(redis),
        validate(installSchema),
        checkActionRateLimit(redis, "chrome_install"),
      ],
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof installSchema>;
      const characterId = (await characters.requireByUserId(request.user.sub)).id;

      request.audit_context!.payload = { chromeDefinitionId: body.chromeDefinitionId, vendorId: body.vendorId };

      const result = await installChrome(characterId, body.chromeDefinitionId, body.vendorId);

      return reply.status(201).send(result as ChromeInstallResponse);
    },
  );

  // POST /api/chrome/uninstall — remove an implant (no refund, no humanity back)
  app.post(
    "/chrome/uninstall",
    {
      preHandler: [
        authenticate,
        setAuditContext("chrome_uninstall"),
        checkCircuitBreaker(redis),
        validate(uninstallSchema),
        checkActionRateLimit(redis, "chrome_uninstall"),
      ],
    },
    async (request) => {
      const body = request.body as z.infer<typeof uninstallSchema>;
      const characterId = (await characters.requireByUserId(request.user.sub)).id;

      request.audit_context!.payload = { installedChromeId: body.installedChromeId };

      return uninstallChrome(characterId, body.installedChromeId) as Promise<ChromeUninstallResponse>;
    },
  );
}
