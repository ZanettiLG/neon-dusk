import { and, eq } from "drizzle-orm";
import { db, type Tx } from "../db";
import { characters, characterEddieBalances, luckyChipBets } from "../db/schema";
import { AppError } from "../middleware/error-handler";
import {
  createRng,
  rollD20,
  validateBet,
  resolveBet,
} from "../game/lucky-chip";
import type { LuckyChipResponse } from "@neon-dusk/shared";

// Neon Dusk — Lucky Chip service (ND-008)
// ============================================================================
// Disposable test minigame: bet X eddies, roll 1d20, >=11 wins 2x, <=10 loses
// (fair 50/50, 0% house edge). Uses a mock per-character balance seeded with
// 1000 eddies on first access. Replaced by the real economy in ND-010.
//
// Concurrency: the balance read happens INSIDE the transaction and the UPDATE
// is guarded by `AND amount = balanceBefore` (optimistic lock). If two bets
// race, exactly one UPDATE matches; the loser retries with a fresh balance
// read, reusing the same d20 roll so a conflict never costs the player a roll.

const SEED_BALANCE = 1000;
const MAX_ATTEMPTS = 3;

/**
 * Play one Lucky Chip round: validate the bet, roll the d20, resolve the
 * outcome and persist the new balance + bet log atomically.
 *
 * The d20 roll happens once before the retry loop — a balance conflict
 * re-reads and re-applies the same roll instead of re-rolling.
 *
 * @param userId — authenticated user id (maps 1:1 to a character)
 * @param bet — eddies wagered (positive integer)
 * @returns the roll, win state, payout and new balance
 */
export async function playLuckyChip(
  userId: string,
  bet: number,
): Promise<LuckyChipResponse> {
  // 1. Find character (once, outside the retry loop)
  const [char] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.userId, userId))
    .limit(1);

  if (!char) {
    throw new AppError(400, "NO_CHARACTER", "No character found for this account");
  }

  // 2. Roll + resolve using pure game logic (once, before the retry loop —
  //    a retry reuses the same roll so a conflict never wastes a winning roll)
  const rng = createRng(Date.now());
  const roll = rollD20(rng);
  const result = resolveBet(bet, roll);

  const messages: Record<string, string> = {
    bet_not_integer: "Bet must be an integer",
    bet_below_min: "Minimum bet is 1 eddie",
    bet_exceeds_balance: "Not enough eddies for this bet",
    bet_unsafe_integer: "Bet amount exceeds safe integer range",
  };

  // 3. Retry loop: read balance, validate, update + log, all inside one tx
  let attempts = 0;
  let lastBalance = 0;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    const success = await db.transaction(async (tx) => {
      // 3a. Lazy-seed balance if missing (idempotent under concurrency)
      const balanceBefore = await ensureBalance(tx, char.id);

      // 3b. Validate bet against the fresh balance
      const validation = validateBet(bet, balanceBefore);
      if (!validation.valid) {
        throw new AppError(400, "INVALID_BET", messages[validation.reason]);
      }

      const balanceAfter = balanceBefore - bet + result.payout;

      // 3c. Optimistic UPDATE: only matches if the balance is unchanged
      const [updated] = await tx
        .update(characterEddieBalances)
        .set({ amount: balanceAfter, updatedAt: new Date() })
        .where(and(
          eq(characterEddieBalances.characterId, char.id),
          eq(characterEddieBalances.amount, balanceBefore),
        ))
        .returning();

      if (!updated) return false; // conflict — another request moved the balance

      // 3d. Log the bet (same tx, only after the optimistic lock holds)
      await tx.insert(luckyChipBets).values({
        characterId: char.id,
        betAmount: bet,
        rollResult: roll,
        payout: result.payout,
        balanceBefore,
        balanceAfter,
      });

      lastBalance = balanceAfter;
      return true;
    });

    if (success) {
      return {
        roll,
        won: result.won,
        payout: result.payout,
        balance: lastBalance,
      };
    }
  }

  throw new AppError(409, "CONFLICT", "Retry limit exceeded — try again");
}

/**
 * Return the character's balance, lazily seeding SEED_BALANCE on first
 * access. Idempotent under concurrency: the INSERT uses ON CONFLICT DO
 * NOTHING, so a racing seed loses silently and the winner's row is read back.
 *
 * @param tx — transaction to run inside
 * @param characterId — character whose balance to ensure
 * @returns the current balance
 */
async function ensureBalance(tx: Tx, characterId: string): Promise<number> {
  const [bal] = await tx
    .select()
    .from(characterEddieBalances)
    .where(eq(characterEddieBalances.characterId, characterId))
    .limit(1);
  if (bal) return bal.amount;

  await tx
    .insert(characterEddieBalances)
    .values({ characterId, amount: SEED_BALANCE })
    .onConflictDoNothing();

  // Re-read — a concurrent request may have created it between our read and insert
  const [fresh] = await tx
    .select()
    .from(characterEddieBalances)
    .where(eq(characterEddieBalances.characterId, characterId))
    .limit(1);
  return fresh?.amount ?? SEED_BALANCE;
}
