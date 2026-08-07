import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { BuyResponse, VendorWithInventory } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
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

export async function vendorRoutes(app: FastifyInstance) {
  // Route params are UUIDs — invalid ids must fail validation before reaching
  // the DB (PostgreSQL would surface an unhandled uuid cast error).
  const paramsSchema = z.object({ id: z.string().uuid() });

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
  app.post("/vendors/:id/buy", { preHandler: [authenticate] }, async (request) => {
    const { id: vendorId } = paramsSchema.parse(request.params);
    const characterId = await requireCharacterId(request.user.sub);

    const bodySchema = z.object({
      itemType: z.string().min(1),
      itemId: z.string().min(1),
      quantity: z.number().int().positive().default(1),
    });
    const body = bodySchema.parse(request.body);

    const result = await buyFromVendor(
      characterId,
      vendorId,
      body.itemType,
      body.itemId,
      body.quantity,
    );
    return { success: true, ...result } as BuyResponse;
  });
}
