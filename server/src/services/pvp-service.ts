import type Redis from "ioredis";
import { randomUUID } from "node:crypto";
import type {
  PvpAttackableResponse,
  PvpCombatResult,
  PvpHistoryResponse,
  PvpTarget,
} from "@neon-dusk/shared";
import { db, type Queryable } from "../db";
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
import { transferEddies, type WalletState } from "../game/economy";
import { ensureWallet } from "./economy-service";
import { instrument } from "../telemetry/instrument";
import { invalidateLeaderboardCache } from "../lib/leaderboard-cache";

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

/** Sum of the character's installed-chrome combat bonuses (body + reflexes). */
async function loadChromePower(q: Queryable, characterId: string): Promise<number> {
  const rows = await q("installed_chrome")
    .select({ bonuses: "chrome_definitions.bonuses" })
    .join("chrome_definitions", "installed_chrome.chrome_definition_id", "chrome_definitions.id")
    .where("installed_chrome.character_id", characterId);
  return calculateChromePower(rows);
}

/** Number of times `attackerId` hit `defenderId` since the start of the week. */
async function countWeeklyAttacks(q: Queryable, attackerId: string, defenderId: string): Promise<number> {
  const [row] = await q("pvp_combats")
    .count("* as n")
    .where("attacker_id", attackerId)
    .where("defender_id", defenderId)
    .where("created_at", ">=", startOfWeekUTC());
  return Number(row?.n ?? 0);
}

/**
 * GET /api/pvp/attackable — candidates within ±10 effective power of the
 * caller, newest accounts excluded (7-day immunity). Rough base-power filter
 * in SQL, chrome-aware filter in JS. Returns an empty list while the caller
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

  const [attacker] = await db("characters").select().where("user_id", userId).limit(1);
  if (!attacker) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

  if (await redis.get(`${PVP_COOLDOWN_KEY}${attacker.id}`)) {
    return { targets: [] };
  }

  const attackerChrome = await loadChromePower(db, attacker.id);
  const minPower = attacker.body + attacker.reflexes + attackerChrome - POWER_RANGE;
  const maxPower = attacker.body + attacker.reflexes + attackerChrome + POWER_RANGE;
  const immunityCutoff = new Date(Date.now() - IMMUNITY_MS);

  const rows = await db("characters")
    .select({
      id: "id",
      name: "name",
      streetCred: "street_cred",
      body: "body",
      reflexes: "reflexes",
    })
    .whereNot("id", attacker.id)
    .where("created_at", "<", immunityCutoff)
    .whereRaw("(body + reflexes) between ? and ?", [minPower, maxPower])
    .orderBy("street_cred", "desc")
    .limit(limit);

  // Re-filter with chrome power (the SQL filter is base-power only) and
  // annotate each candidate with the attacker's weekly hit count on them.
  const targets: PvpTarget[] = [];
  for (const row of rows) {
    const chromePower = await loadChromePower(db, row.id);
    const power = row.body + row.reflexes + chromePower;
    if (power < minPower || power > maxPower) continue;

    targets.push({
      characterId: row.id,
      name: row.name,
      streetCred: row.streetCred,
      power,
      noobShield: hasNoobShield(row.streetCred),
      weeklyAttacksReceived: await countWeeklyAttacks(db, attacker.id, row.id),
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
  const [attackerRow] = await db("characters").select().where("user_id", userId).limit(1);
  if (!attackerRow) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");
  const attackerId = attackerRow.id;

  if (targetId === attackerId) {
    throw new AppError(400, "CANNOT_ATTACK_SELF", "Você não pode atacar a si mesmo");
  }

  if (await redis.get(`${PVP_COOLDOWN_KEY}${attackerId}`)) {
    throw new AppError(429, "PVP_COOLDOWN", "Você ainda está em cooldown de ataque");
  }

  const result = await db.transaction(async (trx) => {
    const [attacker] = await trx("characters")
      .select()
      .where("id", attackerId)
      .forUpdate()
      .limit(1);
    if (!attacker) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

    const [defender] = await trx("characters")
      .select()
      .where("id", targetId)
      .forUpdate()
      .limit(1);
    if (!defender) throw new AppError(404, "TARGET_NOT_FOUND", "Personagem alvo não encontrado");

    if (isImmune(new Date(defender.created_at))) {
      throw new AppError(400, "TARGET_IMMUNE", "Este jogador está imune a ataques");
    }

    if (attacker.nil < PVP_NIL_COST) {
      throw new AppError(400, "INSUFFICIENT_NIL", `Precisa de ${PVP_NIL_COST} NIL para atacar`);
    }

    // Power bracket: effective (non-random) power must be within ±10.
    const attackerChrome = await loadChromePower(trx, attackerId);
    const defenderChrome = await loadChromePower(trx, targetId);
    const attackerBase = attacker.body + attacker.reflexes + attackerChrome;
    const defenderBase = defender.body + defender.reflexes + defenderChrome;
    if (Math.abs(attackerBase - defenderBase) > POWER_RANGE) {
      throw new AppError(400, "POWER_RANGE_EXCEEDED", "Diferença de poder muito grande para atacar");
    }

    // Anti-grief limits (design: weekly attacks on the target).
    const weeklyAttacks = await countWeeklyAttacks(trx, attackerId, targetId);
    const grieferPenalty = isGriefLimited(weeklyAttacks);

    // Resolve the fight (game logic incl. solo role multiplier + crit).
    const { winner, attackerPower, defenderPower } = resolveCombat({
      attacker: {
        body: attacker.body,
        reflexes: attacker.reflexes,
        chromePower: attackerChrome,
        role: attacker.role,
        tranceActive: getCombatTranceBonus(
          attacker.role,
          attacker.ability_active_until ? new Date(attacker.ability_active_until) : null,
          attacker.ability_cooldown_until ? new Date(attacker.ability_cooldown_until) : null,
        ) !== null,
      },
      defender: {
        body: defender.body,
        reflexes: defender.reflexes,
        chromePower: defenderChrome,
        role: defender.role,
        tranceActive: getCombatTranceBonus(
          defender.role,
          defender.ability_active_until ? new Date(defender.ability_active_until) : null,
          defender.ability_cooldown_until ? new Date(defender.ability_cooldown_until) : null,
        ) !== null,
      },
    });
    const attackerWon = winner === "attacker";
    const winnerId = attackerWon ? attackerId : targetId;
    const loserId = attackerWon ? targetId : attackerId;

    // Street cred deltas. The defeat cap (≥3 losses today) protects the
    // actual loser — regardless of whether they were attacker or defender.
    const [loserDefeats] = await trx("pvp_combats")
      .count("* as n")
      .where(function () {
        this.where("attacker_id", loserId).orWhere("defender_id", loserId);
      })
      .whereNot("winner_id", loserId)
      .where("created_at", ">=", startOfDayUTC());
    const loserDefeatsToday = Number(loserDefeats?.n ?? 0);
    const winnerSC = calculateWinnerSC(attackerWon ? attacker.street_cred : defender.street_cred);
    const loserSC = calculateLoserSC(
      attackerWon ? defender.street_cred : attacker.street_cred,
      loserDefeatsToday,
    );

    // Lock both wallets; loot is 10% of the loser's spendable balance (escrow
    // excluded — a fully escrowed wallet can't pay out). No wallet → no loot.
    const [loserWalletRow] = await trx("character_wallets")
      .select()
      .where("character_id", loserId)
      .forUpdate()
      .limit(1);
    const [winnerWalletRow] = await trx("character_wallets")
      .select()
      .where("character_id", winnerId)
      .forUpdate()
      .limit(1);

    const lootAmount = loserWalletRow
      ? calculateLoot(Math.max(0, loserWalletRow.balance - loserWalletRow.escrow), grieferPenalty)
      : 0;

    // ── Persist the fight (single atomic unit) ──
    const combatId = randomUUID();

    // Attacker always pays the NIL cost.
    await trx("characters")
      .update({ nil: attacker.nil - PVP_NIL_COST, updated_at: new Date() })
      .where("id", attackerId);

    // Winner: +SC (capped at 100, lifetime max tracked). No-op when already capped.
    if (winnerSC.change > 0) {
      await trx("characters")
        .update({
          street_cred: winnerSC.newSC,
          max_street_cred_achieved: db.raw("GREATEST(max_street_cred_achieved, ?)", [winnerSC.newSC]),
          updated_at: new Date(),
        })
        .where("id", winnerId);
    }

    // Loser: −SC unless the defeat cap protects them (change is 0 then).
    if (loserSC.change !== 0) {
      await trx("characters")
        .update({ street_cred: loserSC.newSC, updated_at: new Date() })
        .where("id", loserId);
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
      const [updatedLoser] = await trx("character_wallets")
        .update({
          balance: debit.wallet.balance,
          escrow: debit.wallet.escrow,
          lifetime_spent: debit.wallet.lifetimeSpent,
          version: loserWallet.version + 1,
          updated_at: new Date(),
        })
        .where("id", loserWalletRow!.id)
        .where("version", loserWallet.version)
        .returning("*");
      if (!updatedLoser) {
        throw new AppError(409, "CONCURRENCY_CONFLICT", "Carteira alterada concorrentemente. Tente novamente.");
      }
      await trx("transaction_log").insert({
        character_id: loserId,
        type: "PVP_LOSS",
        amount: -lootAmount,
        balance_before: debit.transaction.balanceBefore,
        balance_after: debit.transaction.balanceAfter,
        source: debit.transaction.source,
        reference_type: "pvp",
        reference_id: combatId,
      });

      // Credit the winner; a first-ever win without a wallet seeds it (the
      // standard ensureWallet faucet) so the reward is never lost.
      const winnerWallet: WalletState = winnerWalletRow
        ? {
            balance: winnerWalletRow.balance,
            escrow: winnerWalletRow.escrow,
            lifetimeEarned: winnerWalletRow.lifetime_earned,
            lifetimeSpent: winnerWalletRow.lifetime_spent,
            version: winnerWalletRow.version,
          }
        : await ensureWallet(winnerId, trx);
      const credit = transferEddies(winnerWallet, lootAmount, {
        type: "PVP_REWARD",
        source: "Loot won in PvP",
        referenceType: "pvp",
        referenceId: combatId,
      });
      const [updatedWinner] = await trx("character_wallets")
        .update({
          balance: credit.wallet.balance,
          lifetime_earned: credit.wallet.lifetimeEarned,
          version: winnerWallet.version + 1,
          updated_at: new Date(),
        })
        .where("character_id", winnerId)
        .where("version", winnerWallet.version)
        .returning("*");
      if (!updatedWinner) {
        throw new AppError(409, "CONCURRENCY_CONFLICT", "Carteira alterada concorrentemente. Tente novamente.");
      }
      await trx("transaction_log").insert({
        character_id: winnerId,
        type: "PVP_REWARD",
        amount: lootAmount,
        balance_before: credit.transaction.balanceBefore,
        balance_after: credit.transaction.balanceAfter,
        source: credit.transaction.source,
        reference_type: "pvp",
        reference_id: combatId,
      });

      newBalance = attackerWon ? updatedWinner.balance : updatedLoser.balance;
    } else {
      // No loot — report the attacker's current balance (0 with no wallet).
      const [attackerWallet] = await trx("character_wallets")
        .select("balance")
        .where("character_id", attackerId)
        .limit(1);
      newBalance = attackerWallet?.balance ?? 0;
    }

    // Append-only combat record (id doubles as the loot audit reference).
    const [combat] = await trx("pvp_combats")
      .insert({
        id: combatId,
        attacker_id: attackerId,
        defender_id: targetId,
        attacker_power: attackerPower,
        defender_power: defenderPower,
        winner_id: winnerId,
        loot_amount: lootAmount,
        griefer_penalty: grieferPenalty,
      })
      .returning("*");

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
  const [character] = await db("characters")
    .select("id")
    .where("user_id", userId)
    .limit(1);
  if (!character) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

  let query = db("pvp_combats")
    .select({
      id: "pvp_combats.id",
      attackerName: "a.name",
      defenderName: "d.name",
      attackerPower: "pvp_combats.attacker_power",
      defenderPower: "pvp_combats.defender_power",
      winnerId: "pvp_combats.winner_id",
      lootAmount: "pvp_combats.loot_amount",
      grieferPenalty: "pvp_combats.griefer_penalty",
      createdAt: "pvp_combats.created_at",
    })
    .join({ a: "characters" }, "a.id", "pvp_combats.attacker_id")
    .join({ d: "characters" }, "d.id", "pvp_combats.defender_id")
    .where(function () {
      this.where("pvp_combats.attacker_id", character.id)
        .orWhere("pvp_combats.defender_id", character.id);
    });

  if (cursor) {
    query = query.where("pvp_combats.created_at", "<", new Date(cursor));
  }

  const rows = await query
    .orderBy("pvp_combats.created_at", "desc")
    .limit(limit + 1);

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
