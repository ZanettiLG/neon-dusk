import type { MetroDistrictInfo, MetroMapResponse, Origin } from "@neon-dusk/shared";
import { ORIGINS, originFromDistrictString } from "@neon-dusk/shared";
import { AppError } from "../middleware/error-handler";
import { applyHeatDecay } from "../game/gigs";
import { characterRepository as characters } from "../repositories/character-repository";
import { crewRepository as crews } from "../repositories/crew-repository";
import { gigRepository as gigs } from "../repositories/gig-repository";
import { heatRepository as heat } from "../repositories/heat-repository";

// Neon Dusk — Metro service (issue #18: district map visualization)
// ============================================================================
// Aggregates the three district readouts the map needs — trampos disponíveis
// (static trampo catalog), calor (lazy-decayed on read, NEVER written back) and
// território de bonde (crews.territory_district) — into one response in
// canonical ORIGINS order.

/**
 * GET /api/metro — one aggregated readout per district for the map view.
 * Heat decay is applied lazily on read (same rule as the escape phase) and
 * never persisted here — a GET must not write.
 *
 * @param characterId - The calling character.
 * @returns `{ districts }` — 7 entries in ORIGINS order, zero-filled when a
 *          district has no trampos/heat/territory.
 * @throws AppError 404 NO_CHARACTER when the character does not exist.
 */
export async function getMetroMap(characterId: string): Promise<MetroMapResponse> {
  const character = await characters.findById(characterId);
  if (!character) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

  // 1. Trampos: count the static catalog per origin (district may be the
  //    origin key or the display label — normalize via originFromDistrictString).
  const gigRows = await gigs.listCatalog();
  const gigsByOrigin = new Map<Origin, number>();
  for (const trampo of gigRows) {
    const origin = originFromDistrictString(trampo.district);
    if (origin) gigsByOrigin.set(origin, (gigsByOrigin.get(origin) ?? 0) + 1);
  }

  // 2. Calor: lazy decay applied per row on read; nothing is written back.
  const heatRows = await heat.listForCharacter(characterId);
  const heatByOrigin = new Map<Origin, number>();
  for (const row of heatRows) {
    const origin = originFromDistrictString(row.district);
    if (!origin) continue;
    const { heat: decayed } = applyHeatDecay(Number(row.amount), new Date(row.updated_at));
    heatByOrigin.set(origin, decayed);
  }

  // 3. Território: one crew per district (partial unique index backstops).
  const territories = await crews.listTerritories();
  const territoryByOrigin = new Map<Origin, string>();
  for (const row of territories) {
    const origin = originFromDistrictString(row.territory_district);
    if (origin) territoryByOrigin.set(origin, row.tag);
  }

  const districts: MetroDistrictInfo[] = ORIGINS.map((origin) => ({
    origin,
    gigsAvailable: gigsByOrigin.get(origin) ?? 0,
    heat: heatByOrigin.get(origin) ?? 0,
    territoryCrewTag: territoryByOrigin.get(origin) ?? null,
  }));

  return { districts };
}
