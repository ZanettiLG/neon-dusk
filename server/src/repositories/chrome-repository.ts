import { db, type Queryable } from "../db";
import { AppError } from "../middleware/error-handler";
import { isUniqueViolation } from "../db/pg-errors";

// Neon Dusk — Cromo repository (#158 DB repository layer)
// ============================================================================
// chrome_definitions + installed_chrome access, plus the vendor_inventory
// stock lookup used by the install flow (item_type = 'CHROME').

/** Raw row shape for `chrome_definitions`. */
export interface ChromeDefinitionRow {
  id: string;
  slug: string;
  name: string;
  slot: string;
  tier: number;
  bonuses: Record<string, number>;
  humanity_cost: number;
  base_price: number;
  description: string | null;
  is_active: boolean;
  created_at: Date;
}

/** Raw row shape for `installed_chrome`. */
export interface InstalledChromeRow {
  id: string;
  character_id: string;
  chrome_definition_id: string;
  installed_at: Date;
}

/** Loadout row (installed_chrome ⋈ chrome_definitions). */
export interface InstalledChromeJoinedRow {
  id: string;
  installedId: string;
  installedAt: Date;
  slug: string;
  name: string;
  slot: string;
  tier: number;
  bonuses: Record<string, number>;
  humanity_cost: number;
  base_price: number;
  description: string | null;
  is_active: boolean;
  created_at: Date;
}

export interface ChromeRepository {
  /** Active cromo definition by id (404-level null when absent/inactive). */
  findDefinition(id: string, q?: Queryable): Promise<ChromeDefinitionRow | null>;
  /** Active catalog, optionally filtered by tier/slot, ordered tier+name. */
  listCatalog(
    filters: { tier?: number; slot?: string } | undefined,
    q?: Queryable,
  ): Promise<ChromeDefinitionRow[]>;
  /** Vendor stock row for a chrome slug (item_type = 'CHROME'). */
  findStockItem(vendorId: string, slug: string, q?: Queryable): Promise<{ id: string; vendor_id: string; price: number; stock: number } | null>;
  /** Loadout rows: definition id + slot per install. */
  listInstalled(
    characterId: string,
    q?: Queryable,
  ): Promise<Array<{ definitionId: string; slot: string }>>;
  /** Full installed list (definition columns included), ordered by install time. */
  listInstalledFull(characterId: string, q?: Queryable): Promise<InstalledChromeJoinedRow[]>;
  /** Installed definition ids only (bonus aggregation fast path). */
  listInstalledDefinitionIds(characterId: string, q?: Queryable): Promise<Array<{ chrome_definition_id: string }>>;
  /** Definitions by ids (cromo bonus computation). */
  listDefinitionsByIds(ids: string[], q?: Queryable): Promise<ChromeDefinitionRow[]>;
  /** Bonuses of every installed implant (PvP cromo power). */
  listInstalledBonuses(
    characterId: string,
    q?: Queryable,
  ): Promise<Array<{ bonuses: Record<string, number> }>>;
  /** Install an implant — unique(character, definition) violations map to 409. */
  insertInstalled(characterId: string, definitionId: string, q?: Queryable): Promise<InstalledChromeRow>;
  /** Remove an installed implant. */
  deleteInstalled(installedChromeId: string, q?: Queryable): Promise<void>;
  /** Installed implant scoped by character (joined with name + slot). */
  findInstalledById(
    installedChromeId: string,
    characterId: string,
    q?: Queryable,
  ): Promise<{ id: string; name: string; slot: string } | null>;
}

export function createChromeRepository(q: Queryable = db): ChromeRepository {
  return {
    async findDefinition(id, tx = q) {
      const rows = await tx("chrome_definitions")
        .select()
        .where("id", id)
        .where("is_active", true)
        .limit(1);
      return rows.length ? (rows[0] as ChromeDefinitionRow) : null;
    },

    async listCatalog(filters, tx = q) {
      let query = tx("chrome_definitions")
        .select()
        .where("is_active", true);

      if (filters?.tier !== undefined) query = query.where("tier", filters.tier);
      if (filters?.slot !== undefined) query = query.where("slot", filters.slot);

      return (await query.orderBy("tier").orderBy("name")) as ChromeDefinitionRow[];
    },

    async findStockItem(vendorId, slug, tx = q) {
      const rows = await tx("vendor_inventory")
        .select("id", "vendor_id", "price", "stock")
        .where("vendor_id", vendorId)
        .where("item_type", "CHROME")
        .where("item_id", slug)
        .limit(1);
      return rows.length
        ? (rows[0] as { id: string; vendor_id: string; price: number; stock: number })
        : null;
    },

    async listInstalled(characterId, tx = q) {
      return (await tx("installed_chrome")
        .select("installed_chrome.chrome_definition_id as definitionId", "chrome_definitions.slot")
        .join("chrome_definitions", "installed_chrome.chrome_definition_id", "=", "chrome_definitions.id")
        .where("installed_chrome.character_id", characterId)) as unknown as Array<{
        definitionId: string;
        slot: string;
      }>;
    },

    async listInstalledFull(characterId, tx = q) {
      return (await tx("installed_chrome")
        .select(
          "installed_chrome.id as installedId",
          "installed_chrome.installed_at as installedAt",
          "chrome_definitions.*",
        )
        .join("chrome_definitions", "installed_chrome.chrome_definition_id", "=", "chrome_definitions.id")
        .where("installed_chrome.character_id", characterId)
        .orderBy("installed_chrome.installed_at")) as unknown as InstalledChromeJoinedRow[];
    },

    async listInstalledDefinitionIds(characterId, tx = q) {
      return (await tx("installed_chrome")
        .select("chrome_definition_id")
        .where("character_id", characterId)) as Array<{ chrome_definition_id: string }>;
    },

    async listDefinitionsByIds(ids, tx = q) {
      return (await tx("chrome_definitions")
        .select()
        .whereIn("id", ids)) as ChromeDefinitionRow[];
    },

    async listInstalledBonuses(characterId, tx = q) {
      return (await tx("installed_chrome")
        .select({ bonuses: "chrome_definitions.bonuses" })
        .join("chrome_definitions", "installed_chrome.chrome_definition_id", "chrome_definitions.id")
        .where("installed_chrome.character_id", characterId)) as Array<{
        bonuses: Record<string, number>;
      }>;
    },

    async insertInstalled(characterId, definitionId, tx = q) {
      try {
        const rows = await tx("installed_chrome")
          .insert({ character_id: characterId, chrome_definition_id: definitionId })
          .returning("*");
        return rows[0] as InstalledChromeRow;
      } catch (err) {
        // Implant record — unique(character, definition) is the last line of
        // defense against concurrent duplicate installs.
        if (isUniqueViolation(err)) {
          throw new AppError(409, "ALREADY_INSTALLED", "Cromo já instalado");
        }
        throw err;
      }
    },

    async deleteInstalled(installedChromeId, tx = q) {
      await tx("installed_chrome").delete().where("id", installedChromeId);
    },

    async findInstalledById(installedChromeId, characterId, tx = q) {
      const rows = await tx("installed_chrome")
        .select(
          "installed_chrome.id",
          "chrome_definitions.name",
          "chrome_definitions.slot",
        )
        .join("chrome_definitions", "installed_chrome.chrome_definition_id", "=", "chrome_definitions.id")
        .where("installed_chrome.id", installedChromeId)
        .where("installed_chrome.character_id", characterId)
        .limit(1);
      return rows.length
        ? (rows[0] as { id: string; name: string; slot: string })
        : null;
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const chromeRepository = createChromeRepository();
