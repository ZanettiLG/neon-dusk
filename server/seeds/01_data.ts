import type { Knex } from "knex";
import { GIG_TEMPLATES } from "../src/content/gig-templates";
import { VENDOR_SEED } from "../src/content/vendor-inventories";
import { CHROME_DEFINITIONS } from "../src/content/chrome-definitions";
import { LOOT_TABLES } from "../src/content/loot-tables";

/**
 * Neon Dusk — Consolidated Seed (ND-054)
 * ============================================================================
 * Runtime seeding of the static game catalog: chrome, vendors, inventory, gigs,
 * loot tables, legends, round 1, and game params. Fully idempotent — safe to
 * run multiple times (upserts + ON CONFLICT DO NOTHING).
 *
 * Content is sourced from `server/src/content/*.ts` so catalog changes only
 * need to update those source files, not the seed itself.
 *
 * Run: `npx knex seed:run --knexfile knexfile.ts`
 */

export async function seed(knex: Knex): Promise<void> {
  // ── Chrome definitions (upsert by slug) ──────────────────────────────────
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
      .merge();
  }

  // ── Vendors + inventory (upsert by fixed UUID) ───────────────────────────
  for (const v of VENDOR_SEED) {
    // Skip vendors already seeded in the migration (idempotent by PK)
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
    }
  }

  // ── Gigs (upsert by name) ────────────────────────────────────────────────
  for (const t of GIG_TEMPLATES) {
    const cooldownMinutes =
      t.tier === "t1" ? 10
        : t.tier === "t2" ? 15
        : t.tier === "t3" ? 20
        : t.tier === "t4" ? 25
        : 30;

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
        cooldown_minutes: cooldownMinutes,
      })
      .onConflict("name")
      .merge();
  }

  // ── Loot tables (upsert by fixed UUID) ───────────────────────────────────
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

  // ── Legends (insert if not exists — once-only lore) ──────────────────────
  const existingLegends = await knex("legends").select("id").first();
  if (!existingLegends) {
    await knex("legends").insert([
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
    ]);
  }

  // ── Round 1 (insert if not exists) ───────────────────────────────────────
  const existingRound = await knex("rounds").where({ round_number: 1 }).first();
  if (!existingRound) {
    await knex("rounds").insert({
      round_number: 1,
      started_at: knex.fn.now(),
      status: "active",
    });
  }

  // ── Game params (upsert by key) ──────────────────────────────────────────
  for (const [key, value] of Object.entries({
    ROUND_DURATION_DAYS: "14",
    NIL_REGEN_MINUTES: "5",
    GIG_COOLDOWN_MINUTES: "10",
    PVP_NIL_COST: "10",
    INITIAL_BALANCE: "500",
    MAX_CREW_SIZE: "4",
  })) {
    await knex("game_params")
      .insert({ key, value })
      .onConflict("key")
      .merge(["value"]);
  }
}
