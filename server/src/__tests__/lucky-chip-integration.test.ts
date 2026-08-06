import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { db } from "../db";
import { characterEddieBalances, luckyChipBets } from "../db/schema";
import { startTestServer, json, authHeader } from "./helpers";
import type { AuthResponse, Character, CreateCharacterRequest, LuckyChipResponse } from "@neon-dusk/shared";

// Feature ND-008 — Lucky Chip API: full stack route → service → Postgres.
// Runs against the real Fastify app with a dedicated redis db (5) so neither
// the per-IP rate-limit counters nor other features' keys leak between runs
// (same pattern as auth/2, characters/3, nil/4). The rate cap is raised to
// 1000 because this file fires ~70 requests; the 429 behavior itself is
// covered by rate-limit.test.ts on the same global plugin.

const REDIS_TEST_DB = "redis://localhost:56379/5";
const PASSWORD = "StrongPass123!";
const BET = 10;

let seq = 0;
function uniqueEmail(): string {
  return `chip-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Chip-${Date.now()}-${seq++}`;
}

/** Valid attribute spread: 3 base × 5 + 7 free points = 22. */
function validAttributes(): CreateCharacterRequest["attributes"] {
  return { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 };
}

interface ErrorBody {
  error: string;
  message: string;
  details?: { path: (string | number)[]; message: string }[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Feature ND-008 — Lucky Chip API", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;
  const base = () => `http://127.0.0.1:${server.port}`;

  beforeAll(async () => {
    const redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();
    redis.disconnect();

    app = await buildApp({
      env: envSchema.parse({
        ...process.env,
        REDIS_URL: REDIS_TEST_DB,
        RATE_LIMIT_MAX: "1000",
      }),
    });
    server = await startTestServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Register a fresh account + create a character. Returns token and char id. */
  async function registerAndCreateCharacter(): Promise<{ accessToken: string; characterId: string }> {
    const res = await server.post("/api/auth/register", { email: uniqueEmail(), password: PASSWORD });
    expect(res.status).toBe(201);
    const { accessToken } = await json<AuthResponse>(res);

    const created = await fetch(`${base()}/api/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
      body: JSON.stringify({
        name: uniqueName(),
        origin: "a_paraiso",
        role: "solo",
        attributes: validAttributes(),
      }),
    });
    expect(created.status).toBe(201);
    const character = await json<Character>(created);
    return { accessToken, characterId: character.id };
  }

  /** Register a fresh account WITHOUT a character. */
  async function registerOnly(): Promise<string> {
    const res = await server.post("/api/auth/register", { email: uniqueEmail(), password: PASSWORD });
    expect(res.status).toBe(201);
    const { accessToken } = await json<AuthResponse>(res);
    return accessToken;
  }

  function play(token: string, bet: number): Promise<Response> {
    return server.post("/api/game/lucky-chip", { bet }, authHeader(token));
  }

  /**
   * Sequential-bet tracker: every bet asserts the per-transaction economy
   * formula (balance_after = balance_before - bet + payout) against a locally
   * tracked balance, so any route/service/DB drift fails immediately.
   */
  function makeTracker(initialBalance = 1000) {
    const state = { balance: initialBalance };
    return {
      state,
      async play(token: string, bet: number): Promise<{ body: LuckyChipResponse; balanceBefore: number }> {
        const res = await play(token, bet);
        expect(res.status).toBe(200);
        const body = await json<LuckyChipResponse>(res);
        const expectedPayout = body.won ? bet * 2 : 0;
        expect(body.payout).toBe(expectedPayout);
        expect(body.won).toBe(body.roll >= 11); // roll >= 11 wins, <= 10 loses
        const balanceBefore = state.balance;
        state.balance = balanceBefore - bet + expectedPayout;
        expect(body.balance).toBe(state.balance);
        return { body, balanceBefore };
      },
      /** Play bets of {@link BET} until the requested outcome appears. */
      async playUntil(token: string, wanted: "win" | "loss", maxTries = 30): Promise<{ body: LuckyChipResponse; balanceBefore: number }> {
        for (let i = 0; i < maxTries; i++) {
          const result = await this.play(token, BET);
          if ((wanted === "win" && result.body.won) || (wanted === "loss" && !result.body.won)) return result;
        }
        throw new Error(`never observed a ${wanted} in ${maxTries} plays`);
      },
    };
  }

  describe("POST /api/game/lucky-chip — auth & setup", () => {
    it("should return 401 without an access token", async () => {
      const res = await server.post("/api/game/lucky-chip", { bet: BET });

      expect(res.status).toBe(401);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("should return 400 NO_CHARACTER when the account has no character", async () => {
      const accessToken = await registerOnly();

      const res = await play(accessToken, BET);

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("NO_CHARACTER");
    });

    it("should return the full response shape on a valid bet and lazy-seed 1000 eddies", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();

      const res = await play(accessToken, BET);

      expect(res.status).toBe(200);
      const body = await json<LuckyChipResponse>(res);
      expect(body.roll).toBeGreaterThanOrEqual(1);
      expect(body.roll).toBeLessThanOrEqual(20);
      expect(typeof body.won).toBe("boolean");
      expect(body.payout).toBe(body.won ? 2 * BET : 0);
      // First access seeds the balance: 1000 - 10 + payout.
      expect(body.balance).toBe(1000 - BET + body.payout);

      // Balance row persisted with the new amount.
      const [bal] = await db
        .select({ amount: characterEddieBalances.amount })
        .from(characterEddieBalances)
        .where(eq(characterEddieBalances.characterId, characterId));
      expect(bal?.amount).toBe(body.balance);
    });
  });

  describe("POST /api/game/lucky-chip — win/loss resolution", () => {
    it("should win (roll >= 11) with a 2x payout and a net +bet balance change", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      const tracker = makeTracker();

      const { body, balanceBefore } = await tracker.playUntil(accessToken, "win");

      expect(body.roll).toBeGreaterThanOrEqual(11);
      expect(body.won).toBe(true);
      expect(body.payout).toBe(2 * BET);
      // payout = 2×bet → balance_after = balance_before - bet + 2·bet = +bet.
      expect(body.balance).toBe(balanceBefore + BET);
    });

    it("should lose (roll <= 10) with zero payout and deduct exactly the bet", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      const tracker = makeTracker();

      const { body, balanceBefore } = await tracker.playUntil(accessToken, "loss");

      expect(body.roll).toBeLessThanOrEqual(10);
      expect(body.won).toBe(false);
      expect(body.payout).toBe(0);
      // payout = 0 → balance_after = balance_before - bet exactly.
      expect(body.balance).toBe(balanceBefore - BET);
    });
  });

  describe("POST /api/game/lucky-chip — economy integrity", () => {
    it("should create a transaction log entry matching the response", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      const tracker = makeTracker();

      const { body } = await tracker.play(accessToken, BET);

      const rows = await db
        .select()
        .from(luckyChipBets)
        .where(eq(luckyChipBets.characterId, characterId));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        characterId,
        betAmount: BET,
        rollResult: body.roll,
        payout: body.payout,
        balanceBefore: 1000,
        balanceAfter: body.balance,
      });
    });

    it("should conserve money across a 25-bet sequence: Σ(payout − bet) = Δbalance", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      const tracker = makeTracker();

      for (let i = 0; i < 25; i++) {
        await tracker.play(accessToken, BET);
      }

      // Per-transaction formula held on every step (tracker asserts it); now
      // verify the ledger: no money created or destroyed outside the formula.
      const rows = await db
        .select()
        .from(luckyChipBets)
        .where(eq(luckyChipBets.characterId, characterId));
      expect(rows).toHaveLength(25);
      const netChange = rows.reduce((sum, r) => sum + (r.payout - r.betAmount), 0);
      expect(netChange).toBe(tracker.state.balance - 1000);

      const [bal] = await db
        .select({ amount: characterEddieBalances.amount })
        .from(characterEddieBalances)
        .where(eq(characterEddieBalances.characterId, characterId));
      expect(bal?.amount).toBe(tracker.state.balance);
    });
  });

  describe("POST /api/game/lucky-chip — input validation", () => {
    it("should reject a zero bet", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      const res = await play(accessToken, 0);

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should reject a negative bet", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      const res = await play(accessToken, -5);

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should reject a non-integer bet", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      const res = await play(accessToken, 10.5);

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should reject a bet above the balance with INVALID_BET and a message", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      const res = await play(accessToken, 1001); // seeded balance is 1000

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("INVALID_BET");
      expect(body.message).toMatch(/Not enough eddies/);
    });

    it("should accept a bet equal to the balance exactly", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      const res = await play(accessToken, 1000);

      expect(res.status).toBe(200);
      const body = await json<LuckyChipResponse>(res);
      expect(body.balance).toBe(body.won ? 2000 : 0);
    });
  });

  describe("POST /api/game/lucky-chip — concurrency", () => {
    it("maintains balance integrity across 10 concurrent bets", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();

      // 10 simultaneous bets from a fresh character — exercises both the
      // lazy-seed race (balance row created mid-flight) and the optimistic-lock
      // race (UPDATE ... WHERE amount = balanceBefore) in one shot.
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => play(accessToken, BET)),
      );

      // fetch() fulfills for every HTTP status — a rejection here would be a
      // transport failure, not a business outcome. Retry-exhausted bets must
      // reject with 409 CONFLICT, never 500.
      let committed = 0;
      for (const settled of results) {
        expect(settled.status).toBe("fulfilled");
        const res = (settled as PromiseFulfilledResult<Response>).value;
        if (res.status === 200) {
          committed++;
        } else {
          expect(res.status).toBe(409);
          const body = await json<ErrorBody>(res);
          expect(body.error).toBe("CONFLICT");
        }
      }
      expect(committed).toBeGreaterThan(0);

      // Exactly one log row per committed bet (conflicted attempts write nothing).
      const rows = await db
        .select()
        .from(luckyChipBets)
        .where(eq(luckyChipBets.characterId, characterId));
      expect(rows).toHaveLength(committed);

      // Per-transaction formula holds and no balance ever went negative.
      let net = 0;
      for (const row of rows) {
        expect(row.balanceAfter).toBe(row.balanceBefore - row.betAmount + row.payout);
        expect(row.balanceBefore).toBeGreaterThanOrEqual(0);
        expect(row.balanceAfter).toBeGreaterThanOrEqual(0);
        expect(row.payout).toBe(row.rollResult >= 11 ? row.betAmount * 2 : 0);
        net += row.payout - row.betAmount;
      }

      // Chain integrity, order-independent: every committed row's balanceBefore
      // must be reachable from the 1000 seed via some predecessor's balanceAfter.
      // A lost update (two bets reading the same balance) strands a row here.
      const reachable = new Set<number>([1000]);
      let progressed = true;
      while (progressed) {
        progressed = false;
        for (const row of rows) {
          if (reachable.has(row.balanceBefore) && !reachable.has(row.balanceAfter)) {
            reachable.add(row.balanceAfter);
            progressed = true;
          }
        }
      }
      for (const row of rows) {
        expect(reachable.has(row.balanceBefore)).toBe(true);
      }

      // Money conservation: Σ(payout − bet) over committed bets must equal the
      // observed balance change (seed 1000 → current). This is the check that
      // catches lost updates — the per-row formula holds even when two bets
      // both start from the same balance, but Σ(payout − bet) then diverges
      // from Δbalance.
      const [bal] = await db
        .select({ amount: characterEddieBalances.amount })
        .from(characterEddieBalances)
        .where(eq(characterEddieBalances.characterId, characterId));
      expect(bal?.amount).toBeGreaterThanOrEqual(0);
      expect(net).toBe((bal?.amount ?? 0) - 1000);
    });

    it("should retry an optimistic-lock conflict instead of overwriting a concurrent change", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      // Seed the balance row directly so the starting value is known exactly.
      await db.insert(characterEddieBalances).values({ characterId, amount: 1000 });

      // A concurrent writer bumps the balance to 1001 and HOLDS the row lock.
      // The service's first attempt reads 1000, then its UPDATE blocks on our
      // lock; when we commit 1001 the UPDATE's `WHERE amount = 1000` matches
      // nothing → conflict → the retry loop re-reads 1001 and commits on top.
      let release!: () => void;
      const lockHeld = new Promise<void>((resolve) => { release = resolve; });
      const lockTx = db.transaction(async (tx) => {
        await tx
          .update(characterEddieBalances)
          .set({ amount: 1001 })
          .where(eq(characterEddieBalances.characterId, characterId));
        await lockHeld; // keep the transaction open so the row lock stays held
      });

      await sleep(100); // let the lock transaction acquire the row lock
      const resPromise = play(accessToken, BET); // service reads 1000, blocks on the UPDATE
      await sleep(150); // give the request time to reach the blocked UPDATE
      release();
      await lockTx;

      const res = await resPromise;
      expect(res.status).toBe(200);
      const body = await json<LuckyChipResponse>(res);

      // The bet was applied ON TOP of the concurrent writer's 1001, not over
      // it: the committed row's balanceBefore is 1001 — the value the retry
      // re-read — and the response balance matches 1001 − bet + payout.
      const expected = 1001 - BET + body.payout;
      expect(body.balance).toBe(expected);

      const [row] = await db
        .select()
        .from(luckyChipBets)
        .where(eq(luckyChipBets.characterId, characterId));
      expect(row).toMatchObject({
        characterId,
        betAmount: BET,
        balanceBefore: 1001,
        balanceAfter: expected,
      });

      const [bal] = await db
        .select({ amount: characterEddieBalances.amount })
        .from(characterEddieBalances)
        .where(eq(characterEddieBalances.characterId, characterId));
      expect(bal?.amount).toBe(expected);
    });
  });
});
