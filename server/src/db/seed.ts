import { pathToFileURL } from "node:url";
import { db } from "./index";
import { CHROME_DEFINITIONS } from "../content/chrome-definitions";
import { VENDOR_SEED } from "../content/vendor-inventories";
import { GIG_TEMPLATES } from "../content/gig-templates";
import { LOOT_TABLES } from "../content/loot-tables";

// Neon Dusk — Content seed (ND-054)
// ============================================================================
// Runtime seeding of the static game catalog (chrome, vendors, gigs, loot).
// Fully idempotent: re-running is safe (upserts + conflict-do-nothing).
// Run with `npm run db:seed` after `db:migrate`.

/**
 * Insert the gig catalog from content/gig-templates.ts, deriving the
 * per-tier cooldown (T1 refreshes fast, T2 keeps you out of the same play).
 * Returns how many rows were actually inserted (0 on a no-op re-run).
 */
export async function seedGigs(): Promise<number> {
  let inserted = 0;
  for (const t of GIG_TEMPLATES) {
    const cooldownMinutes =
      t.tier === "t1" ? 10
        : t.tier === "t2" ? 15
        : t.tier === "t3" ? 20
        : t.tier === "t4" ? 25
        : 30;
    const rows = await db("gigs")
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
      .ignore()
      .returning("id");
    inserted += rows.length;
  }
  return inserted;
}

/** Row counts per table from the last seed run. */
export interface SeedResult {
  chrome: number;
  vendors: number;
  inventory: number;
  gigs: number;
  loot: number;
}

/**
 * Run the full content seed (chrome, vendors, inventory, gigs, loot) against
 * the connected database. Idempotent — safe to call repeatedly. Exported so
 * tests can exercise the real executor; `main()` is the CLI wrapper.
 */
export async function seedAll(): Promise<SeedResult> {
  // Chrome — upsert by slug.
  let chromeCount = 0;
  for (const c of CHROME_DEFINITIONS) {
    await db("chrome_definitions")
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
    chromeCount++;
  }

  // Vendors — fixed UUIDs, skip if already present (PK conflict).
  let vendorCount = 0;
  for (const v of VENDOR_SEED) {
    await db("vendors")
      .insert({
        id: v.id,
        name: v.name,
        type: v.type,
        district: v.district,
        description: v.description,
      })
      .onConflict("id")
      .ignore();
    vendorCount++;
  }

  // Vendor inventory — upsert by (vendor_id, item_type, item_id).
  let inventoryCount = 0;
  for (const v of VENDOR_SEED) {
    for (const inv of v.inventory) {
      await db("vendor_inventory")
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

  // Gigs — upsert by name; returns 0 on a no-op re-run.
  const gigCount = await seedGigs();

  // Loot tables — fixed UUIDs, skip if already present (PK conflict).
  let lootCount = 0;
  for (const l of LOOT_TABLES) {
    await db("loot_tables")
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
    lootCount++;
  }

  return { chrome: chromeCount, vendors: vendorCount, inventory: inventoryCount, gigs: gigCount, loot: lootCount };
}

async function main(): Promise<void> {
  console.log("🌆 Seeding Neon Dusk content...");

  const result = await seedAll();

  console.log(
    `✅ Seed complete: ${result.chrome} chrome, ${result.vendors} vendors, ` +
      `${result.inventory} inventory, ${result.gigs} gigs, ${result.loot} loot rows`,
  );
  await db.destroy();
  process.exit(0);
}

// Only run when executed directly (`tsx src/db/seed.ts`), so tests can import
// `seedGigs` without triggering the CLI exit path.
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
}
