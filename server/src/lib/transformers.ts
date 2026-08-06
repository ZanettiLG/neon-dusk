import type { Character } from "@neon-dusk/shared";
import type { characters } from "../db/schema";

// Neon Dusk — DB row → API shape transformers
// ============================================================================

/** Strip row internals — characters carry only public fields. */
export function toPublicCharacter(row: typeof characters.$inferSelect): Character {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    origin: row.origin,
    role: row.role,
    body: row.body,
    reflexes: row.reflexes,
    intelligence: row.intelligence,
    technical: row.technical,
    cool: row.cool,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
