import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../db";
import {
  seedChrome,
  seedVendors,
  seedGigs,
  seedLoot,
  seedLegends,
  seedRound,
  seedGameParams,
} from "../seed/content-seeds";

// #158 DB repository layer — the 7 content seed executors must be idempotent.
// Runs every seed twice against the isolated test stack and asserts the row
// counts are stable (a second run must not duplicate anything).

const EXPECTED = {
  chrome: 5,
  vendors: 4,
  inventory: 8,
  gigs: 19,
  loot: 9,
  legends: 5,
  round: 1,
  params: 6,
} as const;

async function count(tableName: string): Promise<number> {
  const [row] = await db(tableName).select(db.raw("count(*)::int as n"));
  return row!.n;
}

async function runAllSeeds(): Promise<void> {
  await seedChrome(db);
  await seedVendors(db);
  await seedGigs(db);
  await seedLoot(db);
  await seedLegends(db);
  await seedRound(db);
  await seedGameParams(db);
}

describe("content seeds idempotency (#158)", () => {
  beforeAll(async () => {
    // Wipe the content catalog + once-only tables so counts are deterministic
    // regardless of prior test state. resetDb leaves these alone, so truncate
    // them explicitly (same approach as seed-integration.test.ts).
    await db.raw(
      "TRUNCATE TABLE gigs, chrome_definitions, vendors, vendor_inventory, loot_tables, legends, rounds, game_params CASCADE",
    );
    await runAllSeeds();
  });

  it("should seed the full catalog on first run", async () => {
    expect(await count("chrome_definitions")).toBe(EXPECTED.chrome);
    expect(await count("vendors")).toBe(EXPECTED.vendors);
    expect(await count("vendor_inventory")).toBe(EXPECTED.inventory);
    expect(await count("gigs")).toBe(EXPECTED.gigs);
    expect(await count("loot_tables")).toBe(EXPECTED.loot);
    expect(await count("legends")).toBe(EXPECTED.legends);
    expect(await count("rounds")).toBe(EXPECTED.round);
    expect(await count("game_params")).toBe(EXPECTED.params);
  });

  it("should keep every row count stable when the seeds run a second time", async () => {
    await runAllSeeds();

    expect(await count("chrome_definitions")).toBe(EXPECTED.chrome);
    expect(await count("vendors")).toBe(EXPECTED.vendors);
    expect(await count("vendor_inventory")).toBe(EXPECTED.inventory);
    expect(await count("gigs")).toBe(EXPECTED.gigs);
    expect(await count("loot_tables")).toBe(EXPECTED.loot);
    expect(await count("legends")).toBe(EXPECTED.legends);
    expect(await count("rounds")).toBe(EXPECTED.round);
    expect(await count("game_params")).toBe(EXPECTED.params);
  });
});
