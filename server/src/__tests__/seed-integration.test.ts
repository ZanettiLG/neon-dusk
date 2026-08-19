import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../db";
import { resetDb, resetRounds, insertTestCharacter } from "./helpers";
import { seedChrome, seedVendors, seedGigs as seedGigsFn, seedLoot } from "../seed/content-seeds";
import { performRoundReset } from "../services/round-service";
import { walletRepository as wallets } from "../repositories/wallet-repository";

// ND-054 — seed executor integration tests. Real Postgres on the isolated
// test stack (docker-compose.test.yml). These tests run the ACTUAL seed
// functions (seeds/01-04) against a truncated catalog so counts are
// deterministic, then verify idempotency, content correctness, round-reset
// compatibility and wallet integrity.
//
// NOTE: the test DB must be migrated (db:migrate) before this suite — the
// chrome-integration suite already depends on seeded chrome_definitions rows
// for the same reason.

const CONTENT_COUNTS = {
  gigs: 19,
  chrome: 5,
  vendors: 4,
  inventory: 8,
  loot: 9,
} as const;

/** Run the content seed (chrome + vendors + inventory + gigs + loot). */
async function seedAll(): Promise<{
  chrome: number;
  vendors: number;
  inventory: number;
  gigs: number;
  loot: number;
}> {
  const chrome = await seedChrome(db);
  const vendorResult = await seedVendors(db);
  const gigs = await seedGigsFn(db);
  const loot = await seedLoot(db);
  return {
    chrome,
    vendors: vendorResult.vendors,
    inventory: vendorResult.inventory,
    gigs,
    loot,
  };
}

async function count(tableName: string): Promise<number> {
  const [row] = await db(tableName).select(db.raw("count(*)::int as n"));
  return row!.n;
}

describe("ND-054 — seed executor (db/seed)", () => {
  beforeAll(async () => {
    // Wipe account + dependent tables (users, characters, vendors, loot_tables
    // CASCADE) and the two catalog tables resetDb deliberately leaves alone.
    await resetDb();
    await db.raw("TRUNCATE TABLE gigs, chrome_definitions CASCADE");
    await resetRounds(); // round 1 active for the round-reset compatibility test
    await seedAll();
  });

  describe("seed executor", () => {
    it("should populate every content table with the full catalog", async () => {
      expect(await count("gigs")).toBe(CONTENT_COUNTS.gigs);
      expect(await count("chrome_definitions")).toBe(CONTENT_COUNTS.chrome);
      expect(await count("vendors")).toBe(CONTENT_COUNTS.vendors);
      expect(await count("vendor_inventory")).toBe(CONTENT_COUNTS.inventory);
      expect(await count("loot_tables")).toBe(CONTENT_COUNTS.loot);
    });

    it("should be idempotent — a second run changes nothing", async () => {
      const first = await seedAll();
      expect(first).toMatchObject({
        chrome: 5,
        vendors: 4,
        inventory: 8,
        gigs: 19, // upsert processes every template (merge, not insert-only)
        loot: 9,
      });

      expect(await count("gigs")).toBe(CONTENT_COUNTS.gigs);
      expect(await count("chrome_definitions")).toBe(CONTENT_COUNTS.chrome);
      expect(await count("vendors")).toBe(CONTENT_COUNTS.vendors);
      expect(await count("vendor_inventory")).toBe(CONTENT_COUNTS.inventory);
      expect(await count("loot_tables")).toBe(CONTENT_COUNTS.loot);
    });

    it("should restore drifted content on re-run (upsert by slug)", async () => {
      // Simulate a manual price edit; the seed should push it back.
      await db("chrome_definitions")
        .where("slug", "neural-booster")
        .update({ base_price: 9999 });

      await seedAll();

      const [def] = await db("chrome_definitions")
        .select("base_price")
        .where("slug", "neural-booster")
        .limit(1);
      expect(def!.base_price).toBe(1500);
    });

    it("should store chrome definitions with the correct stats", async () => {
      const [booster] = await db("chrome_definitions")
        .select("*")
        .where("slug", "neural-booster")
        .limit(1);
      expect(booster).toMatchObject({
        slug: "neural-booster",
        name: "Neural Booster",
        slot: "frontal_cortex",
        tier: 1,
        humanity_cost: 3,
        base_price: 1500,
        is_active: true,
      });
      expect(booster.bonuses).toEqual({ intelligence: 2, nil_max: 10 });

      const [armor] = await db("chrome_definitions")
        .select("*")
        .where("slug", "subdermal-armor")
        .limit(1);
      expect(armor.bonuses).toEqual({ max_hp: 10 });
    });

    it("should seed 4 vendors with the expected inventory per vendor", async () => {
      const docFios = await db("vendors")
        .select("*")
        .where("id", "00000000-0000-4000-8000-000000000001")
        .limit(1);
      expect(docFios[0]).toMatchObject({
        name: "Doc Fios",
        type: "RIPPERDOC",
        district: "babilonia",
        is_active: true,
      });

      const rows = await db("vendor_inventory")
        .select("vendor_id", "item_id", "price", "stock")
        .orderBy("vendor_id");

      // 8 rows across the 4 fixed vendors: 5 ferrageiro, 0 despachante, 1 stim, 2 market.
      const perVendor = new Map<string, typeof rows>();
      for (const r of rows) {
        perVendor.set(r.vendor_id, [...(perVendor.get(r.vendor_id) ?? []), r]);
      }
      expect(perVendor.get("00000000-0000-4000-8000-000000000001")).toHaveLength(5);
      expect(perVendor.get("00000000-0000-4000-8000-000000000002") ?? []).toHaveLength(0);
      expect(perVendor.get("00000000-0000-4000-8000-000000000003")).toHaveLength(1);
      expect(perVendor.get("00000000-0000-4000-8000-000000000004")).toHaveLength(2);

      // Doc Fios stocks the 5 starter implants at the content prices.
      const docFiosItems = perVendor.get("00000000-0000-4000-8000-000000000001")!;
      expect(docFiosItems.map((i) => i.item_id).sort()).toEqual([
        "gorilla-arms",
        "kiroshi-optics",
        "neural-booster",
        "reflex-tuner",
        "subdermal-armor",
      ]);
      expect(docFiosItems.every((i) => i.stock === -1)).toBe(true);
      const [kiroshi] = docFiosItems.filter((i) => i.item_id === "kiroshi-optics");
      expect(kiroshi.price).toBe(1800);
    });

    it("should derive the gig cooldown from tier (10/15/20/25/30 min)", async () => {
      // seed.ts derives cooldown per tier (balance pass #114: T1=10, T2=15,
      // T3=20, T4=25, T5=30 — "cap all gameplay wait timers at 30s" scaled
      // back to the doc progression anchors).
      const byTier = {
        t1: { count: 6, cooldown: 10 },
        t2: { count: 4, cooldown: 15 },
        t3: { count: 3, cooldown: 20 },
        t4: { count: 3, cooldown: 25 },
        t5: { count: 3, cooldown: 30 },
      } as const;
      for (const [tier, expected] of Object.entries(byTier)) {
        const rows = await db("gigs").select("cooldown_minutes").where("tier", tier);
        expect(rows).toHaveLength(expected.count);
        expect(rows.every((g) => g.cooldown_minutes === expected.cooldown)).toBe(true);
      }
    });

    it("should seed 9 loot tables (4 T1, 5 T2) with weights intact", async () => {
      const t1 = await db("loot_tables").select("*").where("gig_tier", "t1");
      const t2 = await db("loot_tables").select("*").where("gig_tier", "t2");
      expect(t1).toHaveLength(4);
      expect(t2).toHaveLength(5);
      const [eddiesLoot] = t1.filter((l) => l.item_type === "EDDIES");
      expect(eddiesLoot.weight).toBe(40);
      expect(eddiesLoot.min_quantity).toBe(50);
      expect(eddiesLoot.max_quantity).toBe(200);
    });

    it("should not touch existing character data when the seed runs", async () => {
      const { characterId } = await insertTestCharacter();
      await db.transaction(async (trx) => {
        await wallets.ensure(characterId, trx);
      });

      await seedAll();

      const [wallet] = await db("character_wallets")
        .select("balance")
        .where("character_id", characterId);
      expect(wallet!.balance).toBe(500); // seed capital untouched
      const logs = await db("transaction_log")
        .select("id")
        .where("character_id", characterId);
      expect(logs).toHaveLength(1); // only the ADMIN_ADJUSTMENT entry
    });
  });

  describe("seed + round reset compatibility", () => {
    it("should keep content tables populated and dynamic tables empty after a reset", async () => {
      const { characterId } = await insertTestCharacter();
      const [gig] = await db("gigs").select("*").limit(1);
      const [def] = await db("chrome_definitions").select("*").limit(1);
      await db.transaction(async (trx) => {
        await wallets.ensure(characterId, trx);
      });

      // Real player state the reset must wipe.
      await db("active_gigs").insert({
        character_id: characterId,
        gig_id: gig.id,
        phase: "execute",
        status: "active",
      });
      await db("gig_history").insert({
        character_id: characterId,
        gig_id: gig.id,
        outcome: "success",
        phases_completed: ["meet", "legwork", "execute", "escape", "wrap_up"],
        payout: 500,
        street_cred_gained: 2,
        heat_accumulated: 5,
        district: gig.district,
      });
      await db("installed_chrome").insert({ character_id: characterId, chrome_definition_id: def.id });
      await db("heat").insert({ character_id: characterId, district: "babilonia", amount: 10 });
      const [crew] = await db("crews")
        .insert({ name: `Banda-${Date.now()}`, tag: "BND", leader_id: characterId })
        .returning("*");
      await db("crew_members").insert({ crew_id: crew.id, character_id: characterId });

      const result = await performRoundReset();

      expect(result.endedRound).toBe(1);
      expect(result.newRound).toBe(2);

      // Content tables survive the reset untouched.
      expect(await count("gigs")).toBe(CONTENT_COUNTS.gigs);
      expect(await count("chrome_definitions")).toBe(CONTENT_COUNTS.chrome);
      expect(await count("vendors")).toBe(CONTENT_COUNTS.vendors);
      expect(await count("vendor_inventory")).toBe(CONTENT_COUNTS.inventory);
      expect(await count("loot_tables")).toBe(CONTENT_COUNTS.loot);

      // Dynamic player tables are wiped.
      expect(await count("active_gigs")).toBe(0);
      expect(await count("gig_history")).toBe(0);
      expect(await count("installed_chrome")).toBe(0);
      expect(await count("heat")).toBe(0);
      expect(await count("transaction_log")).toBe(0);
      expect(await count("crews")).toBe(0);
      expect(await count("crew_members")).toBe(0);

      // Wallets zeroed, next round opened.
      const [wallet] = await db("character_wallets")
        .select("balance")
        .where("character_id", characterId);
      expect(wallet!.balance).toBe(0);
      const [active] = await db("rounds").select("*").where("status", "active").limit(1);
      expect(active!.round_number).toBe(2);
    });
  });

  describe("wallet initial balance", () => {
    it("should create a new wallet with INITIAL_BALANCE 500 and an audit entry", async () => {
      const { characterId } = await insertTestCharacter();

      const wallet = await db.transaction(async (trx) => wallets.ensure(characterId, trx));

      // wallets.ensure returns the internal camelCase WalletState (public API
      // contract); the raw DB row is snake_case (asserted below).
      expect(wallet).toMatchObject({ balance: 500, escrow: 0, lifetimeEarned: 500, lifetimeSpent: 0 });
      const [log] = await db("transaction_log")
        .select("*")
        .where("character_id", characterId);
      expect(log).toMatchObject({
        type: "ADMIN_ADJUSTMENT",
        amount: 500,
        balance_before: 0,
        balance_after: 500,
        source: "Initial seed capital",
      });
    });

    it("should not reset an existing wallet when the seed runs", async () => {
      const { characterId } = await insertTestCharacter();
      await db.transaction(async (trx) => wallets.ensure(characterId, trx));
      await db("character_wallets")
        .where("character_id", characterId)
        .update({ balance: 1234 });

      await seedAll();

      const [wallet] = await db("character_wallets")
        .select("balance")
        .where("character_id", characterId);
      expect(wallet!.balance).toBe(1234);
      const logs = await db("transaction_log")
        .select("id")
        .where("character_id", characterId);
      expect(logs).toHaveLength(1);
    });
  });
});
