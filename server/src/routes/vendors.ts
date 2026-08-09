import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { BuyResponse, VendorWithInventory } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { checkCircuitBreaker } from "../middleware/circuit-breaker";
import { validate } from "../middleware/validate";
import { setAuditContext } from "../middleware/audit-middleware";
import { checkActionRateLimit } from "../lib/rate-limit";
import { AppError } from "../middleware/error-handler";
import {
  buyFromVendor,
  getVendor,
  listVendors,
  requireCharacterId,
} from "../services/economy-service";

// Neon Dusk — Vendor routes (listing, detail, purchase)
// ============================================================================
// Vendors are static game data; buying is the only mutating endpoint and runs
// atomically inside the economy service's transaction.
//
// ND-053: Purchase is guarded by circuit-break, body validation, and
// per-action rate limiting.

const paramsSchema = z.object({ id: z.string().uuid() });

const buyBodySchema = z.object({
  itemType: z.string().min(1),
  itemId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

export async function vendorRoutes(app: FastifyInstance) {
  const redis = app.redis;

  // GET /api/vendors
  app.get("/vendors", { preHandler: [authenticate] }, async () => {
    return listVendors();
  });

  // GET /api/vendors/:id
  app.get("/vendors/:id", { preHandler: [authenticate] }, async (request) => {
    const { id } = paramsSchema.parse(request.params);
    return getVendor(id) as Promise<VendorWithInventory>;
  });

  // POST /api/vendors/:id/buy
  app.post(
    "/vendors/:id/buy",
    {
      preHandler: [
        authenticate,
        setAuditContext("vendor_purchase"),
        checkCircuitBreaker(redis),
        validate(buyBodySchema),
        checkActionRateLimit(redis, "vendor_purchase"),
      ],
    },
    async (request) => {
      const { id: vendorId } = paramsSchema.parse(request.params);
      const characterId = await requireCharacterId(request.user.sub);
      const body = request.body as z.infer<typeof buyBodySchema>;

      if (body.itemType === "CHROME") {
        throw new AppError(400, "INVALID_PURCHASE", "Chrome deve ser comprado e instalado diretamente no vendedor.");
      }

      request.audit_context!.payload = { vendorId, itemType: body.itemType, itemId: body.itemId, quantity: body.quantity };

      const result = await buyFromVendor(
        characterId,
        vendorId,
        body.itemType,
        body.itemId,
        body.quantity,
      );
      return { success: true, ...result } as BuyResponse;
    },
  );
}
