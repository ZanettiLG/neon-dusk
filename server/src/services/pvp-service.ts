import type Redis from "ioredis";
import { randomUUID } from "node:crypto";
import type {
  PvpAttackableResponse,
  PvpCombatResult,
  PvpHistoryResponse,
  PvpTarget,
  Role,
} from "@neon-dusk/shared";
import { AppError } from "../middleware/error-handler";
import {
  calculateChromePower,
  calculateLoot,
  calculateLoserSC,
  calculateWinnerSC,
  hasNoobShield,
  isGriefLimited,
  isImmune,
  resolveCombat,
} from "../game/pvp";
import { getCombatTranceBonus } from "../game/abilities";
import { resolveOsActiveBonus } from "./os-service";
import { transferEddies, type WalletState } from "../game/economy";
import { instrument } from "../telemetry/instrument";
import { invalidateLeaderboardCache } from "../lib/leaderboard-cache";
import { withTransaction } from "../db";
import type { Queryable } from "../repositories";
import { characterRepository as characters } from "../repositories/character-repository";
import { walletRepository as wallets } from "../repositories/wallet-repository";
import { transactionRepository as transactions } from "../repositories/transaction-repository";
import { chromeRepository as chrome } from "../repositories/chrome-repository";
import { pvpRepository as pvp } from "../repositories/pvp-repository";

// Neon Dusk — PvP service (ND-014)
// ============================================================================
// Orchestrates the attack flow over the pure game logic in game/pvp.ts. The
// whole fight (validation, SC/NIL changes, loot transfer, combat record) runs
// in ONE atomic transaction; the attacker and defender character rows are
// locked FOR UPDATE so concurrent attacks on the same characters serialize.
// The Redis cooldown is only set AFTER the transaction commits — a rollback
// must never burn the attacker's cooldown.

/** NIL cost per attack. */
const PVP_NIL_COST = 20;
/** Max allowed |attacker power − defender power| (matching game/pvp ±10). */
const POWER_RANGE = 10;
/** Redis cooldown key prefix (per attacking character). */
const PVP_COOLDOWN_KEY = "pvp:cooldown:";
/** Attack cooldown, in seconds. */
const PVP_COOLDOWN_S = 15;
/** Account immunity window (must match game/pvp IMMUNITY_DAYS). */
const IMMUNITY_MS = 7 * 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC of the current week — start of the grief window. */
function startOfWeekUTC(now: Date = new Date()): Date {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day;
}

/** 00:00 UTC of the current day — start of the defeat-cap window. */
function startOfDayUTC(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Sum of the character's installed-cromo combat bonuses (body + reflexes). */
async function loadChromePower(characterId: string, q?: Queryable): Promise<number> {
  const rows = await chrome.listInstalledBonuses(characterId, q);
  return calculateChromePower(rows);
}

/** Number of times `attackerId` hit `defenderId` since the start of the week. */
async function countWeeklyAttacks(
  attackerId: string,
  defenderId: string,
  q?: Queryable,
): Promise<number> {
  return pvp.countAttacksSince(attackerId, defenderId, startOfWeekUTC(), q);
}

/**
 * GET /api/pvp/attackable — candidates within ±10 effective power of the
 * caller, newest accounts excluded (7-day immunity). Rough base-power filter
 * in SQL, cromo-aware filter in JS. Returns an empty list while the caller
 * is on cooldown so the client can show "no targets" instead of an error.
 */
export async function getAttackableTargets(
  redis: Redis,
  userId: string,
  limit: number,
  cursor?: string,
): Promise<PvpAttackableResponse> {
  // `cursor` is reserved for future pagination — the response type has no
  // cursor field, so the list is always a single page.
  void cursor;

  const attacker = await characters.findByUserId(userId);
  if (!attacker) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

  if (await redis.get(`${PVP_COOLDOWN_KEY}${attacker.id}`)) {
    return { targets: [] };
  }

  const attackerChrome = await loadChromePower(attacker.id);
  const minPower = attacker.body + attacker.reflexes + attackerChrome - POWER_RANGE;
  const maxPower = attacker.body + attacker.reflexes + attackerChrome + POWER_RANGE;
  const immunityCutoff = new Date(Date.now() - IMMUNITY_MS);

  const rows = await characters.listAttackableTargets(attacker.id, {
    minPower,
    maxPower,
    immunityCutoff,
    limit,
  });

  // Re-filter with cromo power (the SQL filter is base-power only) and
  // annotate each candidate with the attacker's weekly hit count on them.
  const targets: PvpTarget[] = [];
  for (const row of rows) {
    const chromePower = await loadChromePower(row.id);
    const power = row.body + row.reflexes + chromePower;
    if (power < minPower || power > maxPower) continue;

    targets.push({
      characterId: row.id,
      name: row.name,
      streetCred: row.streetCred,
      power,
      noobShield: hasNoobShield(row.streetCred),
      weeklyAttacksReceived: await countWeeklyAttacks(attacker.id, row.id),
    });
  }

  return { targets };
}

/**
 * POST /api/pvp/attack — run one combat. The attacker and defender character
 * rows are locked FOR UPDATE for the whole fight, so concurrent attacks on
 * the same characters serialize instead of double-spending NIL or loot. All
 * validations run inside the transaction; nothing persists if any fails.
 */
export async function executeAttack(
  redis: Redis,
  userId: string,
  targetId: string,
): Promise<PvpCombatResult> {
  // Cheap, non-transactional guards first — fail fast before locking rows.
  const attackerRow = await characters.findByUserId(userId);
  if (!attackerRow) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");
  const attackerId = attackerRow.id;

  if (targetId === attackerId) {
    throw new AppError(400, "CANNOT_ATTACK_SELF", "Você não pode atacar a si mesmo");
  }

  if (await redis.get(`${PVP_COOLDOWN_KEY}${attackerId}`)) {
    throw new AppError(429, "PVP_COOLDOWN", "Você ainda está em cooldown de ataque");
  }

  const result = await withTransaction(async (trx) => {
    const attacker = await characters.findByIdForUpdate(attackerId, trx);
    if (!attacker) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

    const defender = await characters.findByIdForUpdate(targetId, trx);
    if (!defender) throw new AppError(404, "TARGET_NOT_FOUND", "Personagem alvo não encontrado");

    if (isImmune(new Date(defender.created_at))) {
      throw new AppError(400, "TARGET_IMMUNE", "Este jogador está imune a ataques");
    }

    if (attacker.nil < PVP_NIL_COST) {
      throw new AppError(400, "INSUFFICIENT_NIL", `Precisa de ${PVP_NIL_COST} NIL para atacar`);
    }

    // Power bracket: effective (non-random) power must be within ±10.
    const attackerChrome = await loadChromePower(attackerId, trx);
    const defenderChrome = await loadChromePower(targetId, trx);
    const attackerBase = attacker.body + attacker.reflexes + attackerChrome;
    const defenderBase = defender.body + defender.reflexes + defenderChrome;
    if (Math.abs(attackerBase - defenderBase) > POWER_RANGE) {
      throw new AppError(400, "POWER_RANGE_EXCEEDED", "Diferença de poder muito grande para atacar");
    }

    // Anti-grief limits (design: weekly attacks on the target).
    const weeklyAttacks = await countWeeklyAttacks(attackerId, targetId, trx);
    const grieferPenalty = isGriefLimited(weeklyAttacks);

    // Resolve the fight (game logic incl. bicho role multiplier + crit).
    // OS multipliers come from the shared resolver (issue #28 review, cycle 2).
    const attackerOs = await resolveOsActiveBonus(attacker, trx);
    const defenderOs = await resolveOsActiveBonus(defender, trx);
    const { winner, attackerPower, defenderPower } = resolveCombat({
      attacker: {
        body: attacker.body,
        reflexes: attacker.reflexes,
        chromePower: attackerChrome,
        role: attacker.role as Role,
        tranceActive: getCombatTranceBonus(
          attacker.role as Role,
          attacker.ability_active_until ? new Date(attacker.ability_active_until) : null,
          attacker.ability_cooldown_until ? new Date(attacker.ability_cooldown_until) : null,
        ) !== null,
        osBonus: attackerOs,
      },
      defender: {
        body: defender.body,
        reflexes: defender.reflexes,
        chromePower: defenderChrome,
        role: defender.role as Role,
        tranceActive: getCombatTranceBonus(
          defender.role as Role,
          defender.ability_active_until ? new Date(defender.ability_active_until) : null,
          defender.ability_cooldown_until ? new Date(defender.ability_cooldown_until) : null,
        ) !== null,
        osBonus: defenderOs,
      },
    });
    const attackerWon = winner === "attacker";
    const winnerId = attackerWon ? attackerId : targetId;
    const loserId = attackerWon ? targetId : attackerId;

    // Moral deltas. The defeat cap (≥3 losses today) protects the
    // actual loser — regardless of whether they were attacker or defender.
    const loserDefeatsToday = await pvp.countDefeatsSince(loserId, startOfDayUTC(), trx);
    const winnerSC = calculateWinnerSC(attackerWon ? attacker.street_cred : defender.street_cred);
    const loserSC = calculateLoserSC(
      attackerWon ? defender.street_cred : attacker.street_cred,
      loserDefeatsToday,
    );

    // Lock both wallets; loot is 10% of the loser's spendable balance (escrow
    // excluded — a fully escrowed wallet can't pay out). No wallet → no loot.
    const loserWalletRow = await wallets.getForUpdate(loserId, trx);
    const winnerWalletRow = await wallets.getForUpdate(winnerId, trx);

    const lootAmount = loserWalletRow
      ? calculateLoot(Math.max(0, loserWalletRow.balance - loserWalletRow.escrow), grieferPenalty)
      : 0;

    // ── Persist the fight (single atomic unit) ──
    const combatId = randomUUID();

    // Attacker always pays the NIL cost.
    await characters.updateNil(attackerId, attacker.nil - PVP_NIL_COST, trx);

    // Winner: +SC (capped at 100, lifetime max tracked). No-op when already capped.
    if (winnerSC.change > 0) {
      await characters.updateStreetCredMax(winnerId, winnerSC.newSC, trx);
    }

    // Loser: −SC unless the defeat cap protects them (change is 0 then).
    if (loserSC.change !== 0) {
      await characters.updateStreetCredDelta(loserId, loserSC.newSC, trx);
    }

    // Loot: debit loser, credit winner — both with version CAS, audited.
    let newBalance = 0;
    if (lootAmount > 0) {
      const loserWallet: WalletState = {
        balance: loserWalletRow!.balance,
        escrow: loserWalletRow!.escrow,
        lifetimeEarned: loserWalletRow!.lifetime_earned,
        lifetimeSpent: loserWalletRow!.lifetime_spent,
        version: loserWalletRow!.version,
      };
      const debit = transferEddies(loserWallet, -lootAmount, {
        type: "PVP_LOSS",
        source: "Loot stolen in PvP",
        referenceType: "pvp",
        referenceId: combatId,
      });
      const updatedLoser = await wallets.updateOptimisticById(
        loserWalletRow!.id,
        loserWallet.version,
        {
          balance: debit.wallet.balance,
          escrow: debit.wallet.escrow,
          lifetime_spent: debit.wallet.lifetimeSpent,
        },
        trx,
      );
      if (!updatedLoser) {
        throw new AppError(409, "CONCURRENCY_CONFLICT", "Carteira alterada concorrentemente. Tente novamente.");
      }
      await transactions.insert(
        {
          character_id: loserId,
          type: "PVP_LOSS",
          amount: -lootAmount,
          balance_before: debit.transaction.balanceBefore,
          balance_after: debit.transaction.balanceAfter,
          source: debit.transaction.source,
          reference_type: "pvp",
          reference_id: combatId,
        },
        trx,
      );

      // Credit the winner; a first-ever win without a wallet seeds it (the
      // standard wallets.ensure faucet) so the reward is never lost.
      const winnerWallet: WalletState = winnerWalletRow
        ? {
            balance: winnerWalletRow.balance,
            escrow: winnerWalletRow.escrow,
            lifetimeEarned: winnerWalletRow.lifetime_earned,
            lifetimeSpent: winnerWalletRow.lifetime_spent,
            version: winnerWalletRow.version,
          }
        : await wallets.ensure(winnerId, trx);
      const credit = transferEddies(winnerWallet, lootAmount, {
        type: "PVP_REWARD",
        source: "Loot won in PvP",
        referenceType: "pvp",
        referenceId: combatId,
      });
      const updatedWinner = await wallets.updateOptimistic(
        winnerId,
        winnerWallet.version,
        { balance: credit.wallet.balance, lifetime_earned: credit.wallet.lifetimeEarned },
        trx,
      );
      if (!updatedWinner) {
        throw new AppError(409, "CONCURRENCY_CONFLICT", "Carteira alterada concorrentemente. Tente novamente.");
      }
      await transactions.insert(
        {
          character_id: winnerId,
          type: "PVP_REWARD",
          amount: lootAmount,
          balance_before: credit.transaction.balanceBefore,
          balance_after: credit.transaction.balanceAfter,
          source: credit.transaction.source,
          reference_type: "pvp",
          reference_id: combatId,
        },
        trx,
      );

      newBalance = attackerWon ? updatedWinner.balance : updatedLoser.balance;
    } else {
      // No loot — report the attacker's current balance (0 with no wallet).
      const attackerBalance = await wallets.getBalance(attackerId, trx);
      newBalance = attackerBalance ?? 0;
    }

    // Append-only combat record (id doubles as the loot audit reference).
    const combat = await pvp.insertCombat(
      {
        id: combatId,
        attacker_id: attackerId,
        defender_id: targetId,
        attacker_power: attackerPower,
        defender_power: defenderPower,
        winner_id: winnerId,
        loot_amount: lootAmount,
        griefer_penalty: grieferPenalty,
      },
      trx,
    );

    return {
      combatId: combat.id,
      won: attackerWon,
      attackerPower,
      defenderPower,
      lootAmount,
      streetCredChange: attackerWon ? winnerSC.change : loserSC.change,
      newStreetCred: attackerWon ? winnerSC.newSC : loserSC.newSC,
      newBalance,
    };
  });

  // Post-commit side effects: cooldown + telemetry + leaderboard invalidation.
  // Never set the cooldown when the transaction rolled back — the attacker
  // must be able to retry. Leaderboard cache is dropped unconditionally
  // because any fight can move SC for both winner and loser (#74).
  await redis.set(`${PVP_COOLDOWN_KEY}${attackerId}`, "1", "EX", PVP_COOLDOWN_S);
  await invalidateLeaderboardCache(redis);
  instrument({
    eventType: "PVP_ATTACK",
    actorId: attackerId,
    payload: { targetId, won: result.won, lootAmount: result.lootAmount },
  });

  return result;
}

/**
 * GET /api/pvp/history — the character's recent fights (as attacker or
 * defender), newest first, cursor-paginated by `createdAt` (ISO 8601).
 * One extra row is read to detect the next page.
 */
export async function getCombatHistory(
  userId: string,
  limit: number = 20,
  cursor?: string,
): Promise<PvpHistoryResponse> {
  const character = await characters.findByUserId(userId);
  if (!character) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

  const rows = await pvp.listRecent(character.id, limit, cursor);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    combats: page.map((row) => ({
      id: row.id,
      attackerName: row.attackerName,
      defenderName: row.defenderName,
      attackerPower: row.attackerPower,
      defenderPower: row.defenderPower,
      winnerId: row.winnerId,
      won: row.winnerId === character.id,
      lootAmount: row.lootAmount,
      grieferPenalty: row.grieferPenalty,
      createdAt: new Date(row.createdAt).toISOString(),
    })),
    nextCursor: hasMore ? new Date(page[page.length - 1].createdAt).toISOString() : null,
  };
}
