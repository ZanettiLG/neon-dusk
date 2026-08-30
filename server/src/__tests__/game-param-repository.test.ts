import { describe, it, expect, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import {
  gameParamRepository as gameParams,
  getGameParam,
  invalidateGameParamCache,
} from "../repositories/game-param-repository";

// ND-052 — game param cache/fallback unit tests against the real Postgres
// test stack. Uses dedicated keys (never the canonical params) and cleans up
// after itself so the shared game_params table stays canonical for the rest
// of the singleFork run.

const KEY = `TEST_PARAM_${randomUUID()}`;

async function insertParam(value: string): Promise<void> {
  await db("game_params").insert({ key: KEY, value });
}

/** Create a real admin user row so the updated_by FK resolves. */
async function insertAdminUser(): Promise<string> {
  const [user] = await db("users")
    .insert({
      email: `param-admin-${randomUUID()}@test.com`,
      password_hash: "test-hash",
    })
    .returning("id");
  return user.id as string;
}

async function updateParamRaw(value: string): Promise<void> {
  // Bypasses the repository (and therefore the cache invalidation) on purpose.
  await db("game_params").update({ value }).where("key", KEY);
}

async function readParamDb(): Promise<string | undefined> {
  const rows = await db("game_params").select("value").where("key", KEY).limit(1);
  return rows.length > 0 ? (rows[0] as { value: string }).value : undefined;
}

describe("getGameParam (ND-052)", () => {
  afterEach(async () => {
    await db("game_params").where("key", KEY).del();
    invalidateGameParamCache();
  });

  it("should return the fallback when the key does not exist", async () => {
    expect(await getGameParam(KEY, "42")).toBe("42");
  });

  it("should read the DB value when the key exists", async () => {
    await insertParam("7");
    expect(await getGameParam(KEY, "42")).toBe("7");
  });

  it("should serve the cached value within the 30s window even if the DB changes", async () => {
    await insertParam("7");
    expect(await getGameParam(KEY, "42")).toBe("7"); // DB read → cached

    // Mutate the row directly (bypassing the repository) — the cache must
    // still serve the value read 30s ago.
    await updateParamRaw("9");
    expect(await getGameParam(KEY, "42")).toBe("7");
    expect(await readParamDb()).toBe("9");
  });

  it("should drop the cache entry on invalidateGameParamCache", async () => {
    await insertParam("7");
    expect(await getGameParam(KEY, "42")).toBe("7");

    await updateParamRaw("9");
    invalidateGameParamCache(KEY);
    expect(await getGameParam(KEY, "42")).toBe("9");
  });

  it("should invalidate the cache entry when the repository set() updates a param", async () => {
    await insertParam("7");
    expect(await getGameParam(KEY, "42")).toBe("7");

    const adminUserId = await insertAdminUser();
    await gameParams.set(KEY, "11", adminUserId);
    expect(await getGameParam(KEY, "42")).toBe("11");
  });

  it("should re-read from the DB once the 30s TTL expires", async () => {
    // Only Date is faked — setTimeout/setInterval stay real so the pg driver's
    // internal timers keep working while Date.now() is controllable.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await insertParam("7");
      expect(await getGameParam(KEY, "42")).toBe("7"); // DB read → cached

      await updateParamRaw("9");
      // Within the 30s window the cache still serves the value read earlier.
      expect(await getGameParam(KEY, "42")).toBe("7");

      // Advance the clock past the TTL — the next read must hit the DB again.
      vi.setSystemTime(new Date(Date.now() + 30_001));
      expect(await getGameParam(KEY, "42")).toBe("9");
    } finally {
      vi.useRealTimers();
    }
  });
});
