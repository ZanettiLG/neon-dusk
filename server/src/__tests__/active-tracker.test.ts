import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import { ACTIVE_USER_TTL_S, trackActiveUser } from "../telemetry/active-tracker";
import { activeCharacters } from "../telemetry/metrics";

// ND-007 — active user tracking. trackActiveUser writes `auth:active:{userId}`
// keys with a 24h TTL; the count of those keys backs the active_characters
// gauge. Key/TTL assertions use a dedicated redis db (10); the gauge test uses
// the env redis (db 0) because the gauge's scan is bound to env.REDIS_URL.

const REDIS_TEST_DB = "redis://localhost:56379/10";
const USER_1 = "11111111-1111-4111-8111-111111111111";

describe("trackActiveUser (active tracker)", () => {
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.flushdb();
    redis.disconnect();
  });

  it("should create a Redis key with the auth:active: prefix", async () => {
    await trackActiveUser(redis, USER_1);

    expect(await redis.exists(`auth:active:${USER_1}`)).toBe(1);
  });

  it("should set a 24h TTL on the key", async () => {
    await trackActiveUser(redis, USER_1);

    const ttl = await redis.ttl(`auth:active:${USER_1}`);
    // Freshly set key: TTL is the full 24h (a second boundary may have passed,
    // so allow exactly one second of drift).
    expect(ttl).toBeGreaterThanOrEqual(ACTIVE_USER_TTL_S - 1);
    expect(ttl).toBeLessThanOrEqual(ACTIVE_USER_TTL_S);
  });

  it("should count active users in the activeCharacters gauge", async () => {
    // The gauge scans the env redis (db 0) — wipe leftover keys first.
    const envRedis = new Redis(process.env.REDIS_URL!, { lazyConnect: true });
    await envRedis.connect();
    const stale = await envRedis.keys("auth:active:*");
    if (stale.length > 0) await envRedis.del(...stale);

    await trackActiveUser(envRedis, "u-1");
    await trackActiveUser(envRedis, "u-2");
    await trackActiveUser(envRedis, "u-3");

    const gauge = await activeCharacters.get();
    expect(gauge.values[0].value).toBe(3);

    const tracked = await envRedis.keys("auth:active:*");
    if (tracked.length > 0) await envRedis.del(...tracked);
    envRedis.disconnect();
  });
});
