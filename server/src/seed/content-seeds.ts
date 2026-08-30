import type { Knex } from "knex";
import { CHROME_DEFINITIONS } from "../content/chrome-definitions";
import { VENDOR_SEED } from "../content/vendor-inventories";
import { GIG_TEMPLATES } from "../content/gig-templates";
import { LOOT_TABLES } from "../content/loot-tables";
import { CONSUMABLE_CATALOG } from "../content/consumables";

// Neon Dusk — Content seed executors (#158 DB repository layer)
// ============================================================================
// The actual seed implementations, importable from tests and re-exported by
// the thin Knex CLI seed files in server/seeds/. All seeds are idempotent —
// re-running is safe (upserts + conflict-do-nothing + once-only lore).
//
// (The implementations live under src/ so tests can import them without
// breaking the tsconfig rootDir; server/seeds/0X_*.ts re-export for the CLI.)

/** Per-tier trampo cooldown, in minutes (balance pass #114). */
function cooldownForTier(tier: string): number {
  switch (tier) {
    case "t1":
      return 10;
    case "t2":
      return 15;
    case "t3":
      return 20;
    case "t4":
      return 25;
    default:
      return 30;
  }
}

/** Seed cromo definitions, upserting by slug. Returns the row count processed. */
export async function seedChrome(knex: Knex): Promise<number> {
  for (const c of CHROME_DEFINITIONS) {
    await knex("chrome_definitions")
      .insert({
        slug: c.slug,
        name: c.name,
        slot: c.slot,
        tier: c.tier,
        bonuses: c.bonuses,
        humanity_cost: c.humanityCost,
        base_price: c.basePrice,
        description: c.description,
        is_active: true,
      })
      .onConflict("slug")
      .merge([
        "name",
        "slot",
        "tier",
        "bonuses",
        "humanity_cost",
        "base_price",
        "description",
      ]);
  }
  return CHROME_DEFINITIONS.length;
}

/** Seed vendors and their inventory. Returns row counts processed. */
export async function seedVendors(knex: Knex): Promise<{ vendors: number; inventory: number }> {
  let inventoryCount = 0;
  for (const v of VENDOR_SEED) {
    await knex("vendors")
      .insert({
        id: v.id,
        name: v.name,
        type: v.type,
        district: v.district,
        description: v.description,
      })
      .onConflict("id")
      .ignore();

    for (const inv of v.inventory) {
      await knex("vendor_inventory")
        .insert({
          vendor_id: v.id,
          item_type: inv.itemType,
          item_id: inv.itemId,
          price: inv.price,
          stock: inv.stock,
        })
        .onConflict(["vendor_id", "item_type", "item_id"])
        .merge(["price", "stock"]);
      inventoryCount++;
    }
  }
  return { vendors: VENDOR_SEED.length, inventory: inventoryCount };
}

/**
 * Seed the trampo catalog, upserting by name. Returns the row count processed.
 */
export async function seedGigs(knex: Knex): Promise<number> {
  for (const t of GIG_TEMPLATES) {
    await knex("gigs")
      .insert({
        name: t.name,
        description: t.description,
        tier: t.tier,
        type: t.type,
        district: t.district,
        difficulty: t.difficulty,
        escape_difficulty: t.escapeDifficulty,
        required_stats: t.requiredStats,
        required_street_cred: t.requiredStreetCred,
        base_reward: t.baseReward,
        nil_cost: t.nilCost,
        heat_generated: t.heatGenerated,
        legwork_minutes: t.legworkMinutes,
        cooldown_minutes: cooldownForTier(t.tier),
      })
      .onConflict("name")
      .merge([
        "description",
        "tier",
        "type",
        "district",
        "difficulty",
        "escape_difficulty",
        "required_stats",
        "required_street_cred",
        "base_reward",
        "nil_cost",
        "heat_generated",
        "legwork_minutes",
        "cooldown_minutes",
      ]);
  }
  return GIG_TEMPLATES.length;
}

/** Seed loot tables, ignoring conflicts on the fixed UUIDs. Returns the row count processed. */
export async function seedLoot(knex: Knex): Promise<number> {
  for (const l of LOOT_TABLES) {
    await knex("loot_tables")
      .insert({
        id: l.id,
        gig_tier: l.gigTier,
        item_type: l.itemType,
        item_id: l.itemId,
        weight: l.weight,
        min_quantity: l.minQuantity,
        max_quantity: l.maxQuantity,
      })
      .onConflict("id")
      .ignore();
  }
  return LOOT_TABLES.length;
}

/** Seed the sanity-consumable catalog, upserting by slug. Returns the count. */
export async function seedConsumables(knex: Knex): Promise<number> {
  for (const c of CONSUMABLE_CATALOG) {
    await knex("consumables")
      .insert({
        slug: c.slug,
        name: c.name,
        tier: c.tier,
        restore_amount: c.restoreAmount,
        cooldown_hours: c.cooldownHours,
        is_active: true,
      })
      .onConflict("slug")
      .merge(["name", "tier", "restore_amount", "cooldown_hours"]);
  }
  return CONSUMABLE_CATALOG.length;
}

const SEED_LEGENDS = [
  {
    character_name: "Razorback",
    drink_name: "Cromo no Gelo",
    achieved_at: "2085-03-15 02:47:00+00",
    crew_name: null,
  },
  {
    character_name: "Ghostwire",
    drink_name: "Flatline Azul",
    achieved_at: "2085-06-02 23:11:00+00",
    crew_name: null,
  },
  {
    character_name: "Dama de Paus",
    drink_name: "Sangue e Circuito",
    achieved_at: "2086-01-20 05:33:00+00",
    crew_name: "Os Sem Rosto",
  },
  {
    character_name: "Zé do Gatilho",
    drink_name: "O Último Gole",
    achieved_at: "2086-09-08 18:59:00+00",
    crew_name: null,
  },
  {
    character_name: "Mão Fria",
    drink_name: "Nevasca Elétrica",
    achieved_at: "2087-04-04 14:22:00+00",
    crew_name: "Filhos do Fluxo",
  },
];

/** Seed the founding legends (only when the table is empty). */
export async function seedLegends(knex: Knex): Promise<void> {
  const existing = await knex("legends").select("id").first();
  if (existing) return;

  await knex("legends").insert(SEED_LEGENDS);
}

/** Seed round 1 (insert only if absent). */
export async function seedRound(knex: Knex): Promise<void> {
  const existing = await knex("rounds").where({ round_number: 1 }).first();
  if (existing) return;

  await knex("rounds").insert({
    round_number: 1,
    started_at: knex.fn.now(),
    status: "active",
  });
}

const DEFAULT_PARAMS: Record<string, string> = {
  ROUND_DURATION_DAYS: "14",
  NIL_REGEN_MINUTES: "5",
  GIG_COOLDOWN_MINUTES: "10",
  PVP_NIL_COST: "10",
  INITIAL_BALANCE: "500",
  MAX_CREW_SIZE: "4",
};

/** Seed the default game params, upserting by key. */
export async function seedGameParams(knex: Knex): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_PARAMS)) {
    await knex("game_params")
      .insert({ key, value })
      .onConflict("key")
      .merge(["value"]);
  }
}
