import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Redis from "ioredis";
import {
  nilSpentTotal,
  eddiesEarnedTotal,
  eddiesSpentTotal,
  gigsCompletedTotal,
  pvpAttacksTotal,
  activeCharacters,
} from "../telemetry/metrics";
import { trackActiveUser } from "../telemetry/active-tracker";

// ND-007 — Prometheus counters/gauge unit tests. Counters are process
// singletons (singleFork shares the registry across files), so each test
// starts from a reset() and only ever asserts relative increments.

const CHAR_1 = "11111111-1111-4111-8111-111111111111";
const CHAR_2 = "22222222-2222-4222-8222-222222222222";

describe("Telemetry metric counters", () => {
  beforeEach(() => {
    for (const counter of [
      nilSpentTotal,
      eddiesEarnedTotal,
      eddiesSpentTotal,
      gigsCompletedTotal,
      pvpAttacksTotal,
    ]) {
      counter.reset();
    }
  });

  it("should increment a counter and reflect the value", async () => {
    nilSpentTotal.inc({ characterId: CHAR_1 });

    const metric = await nilSpentTotal.get();
    expect(metric.values).toHaveLength(1);
    expect(metric.values[0].labels.characterId).toBe(CHAR_1);
    expect(metric.values[0].value).toBe(1);
  });

  it("should accumulate across multiple increments", async () => {
    eddiesEarnedTotal.inc({ characterId: CHAR_1 }, 50);
    eddiesEarnedTotal.inc({ characterId: CHAR_1 }, 30);
    eddiesEarnedTotal.inc({ characterId: CHAR_1 }, 20);

    const metric = await eddiesEarnedTotal.get();
    expect(metric.values[0].value).toBe(100);
  });

  it("should track label sets independently per character", async () => {
    eddiesEarnedTotal.inc({ characterId: CHAR_1 }, 100);
    eddiesEarnedTotal.inc({ characterId: CHAR_2 }, 250);
    eddiesSpentTotal.inc({ characterId: CHAR_1 }, 40);

    const earned = await eddiesEarnedTotal.get();
    const byChar = Object.fromEntries(earned.values.map((v) => [v.labels.characterId, v.value]));
    expect(byChar[CHAR_1]).toBe(100);
    expect(byChar[CHAR_2]).toBe(250);

    // Different counters with the same label value stay independent.
    const spent = await eddiesSpentTotal.get();
    expect(spent.values[0].value).toBe(40);
  });

  it("should update the active_characters gauge when trackActiveUser is called", async () => {
    // The gauge scans the env redis (db 0) — wipe leftover keys from other
    // files first so the count only reflects what this test tracks.
    const envRedis = new Redis(process.env.REDIS_URL!, { lazyConnect: true });
    await envRedis.connect();
    const stale = await envRedis.keys("auth:active:*");
    if (stale.length > 0) await envRedis.del(...stale);

    await trackActiveUser(envRedis, `u-${CHAR_1}`);
    await trackActiveUser(envRedis, `u-${CHAR_2}`);

    const gauge = await activeCharacters.get();
    expect(gauge.values[0].value).toBe(2);

    const tracked = await envRedis.keys("auth:active:*");
    if (tracked.length > 0) await envRedis.del(...tracked);
    envRedis.disconnect();
  });

  it("should set active_characters to 0 when Redis is unreachable", async () => {
    // The gauge's collect() creates a fresh Redis connection per scrape; make
    // that connect() fail so the collect path resolves to 0 (best-effort).
    const connectSpy = vi
      .spyOn(Redis.prototype, "connect")
      .mockRejectedValue(new Error("ECONNREFUSED"));
    try {
      const gauge = await activeCharacters.get();
      expect(gauge.values[0].value).toBe(0);
    } finally {
      connectSpy.mockRestore();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
