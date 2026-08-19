import { db, type Queryable } from "../db";

// Neon Dusk — PvP repository (#158 DB repository layer)
// ============================================================================

/** Raw row shape for `pvp_combats`. */
export interface PvpCombatRow {
  id: string;
  attacker_id: string;
  defender_id: string;
  attacker_power: number;
  defender_power: number;
  winner_id: string;
  loot_amount: number;
  griefer_penalty: boolean;
  created_at: Date;
}

/** Insert input for a combat record. */
export interface PvpCombatInsert {
  id: string;
  attacker_id: string;
  defender_id: string;
  attacker_power: number;
  defender_power: number;
  winner_id: string;
  loot_amount: number;
  griefer_penalty: boolean;
}

/** Recent-combats row (joined with attacker/defender names). */
export interface PvpCombatJoinedRow {
  id: string;
  attackerName: string;
  defenderName: string;
  attackerPower: number;
  defenderPower: number;
  winnerId: string;
  lootAmount: number;
  grieferPenalty: boolean;
  createdAt: Date;
}

export interface PvpRepository {
  /** Append a combat record (id doubles as the loot audit reference). */
  insertCombat(entry: PvpCombatInsert, q?: Queryable): Promise<PvpCombatRow>;
  /** Recent fights (as attacker or defender), +1 row for pagination. */
  listRecent(
    characterId: string,
    limit: number,
    cursor: string | undefined,
    q?: Queryable,
  ): Promise<PvpCombatJoinedRow[]>;
  /** Attacks by `attackerId` on `defenderId` since `since` (grief window). */
  countAttacksSince(
    attackerId: string,
    defenderId: string,
    since: Date,
    q?: Queryable,
  ): Promise<number>;
  /** Defeats suffered by a character since `since` (daily defeat cap). */
  countDefeatsSince(characterId: string, since: Date, q?: Queryable): Promise<number>;
}

export function createPvpRepository(q: Queryable = db): PvpRepository {
  return {
    async insertCombat(entry, tx = q) {
      const rows = await tx("pvp_combats").insert(entry).returning("*");
      return rows[0] as PvpCombatRow;
    },

    async listRecent(characterId, limit, cursor, tx = q) {
      let query = tx("pvp_combats")
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
          this.where("pvp_combats.attacker_id", characterId)
            .orWhere("pvp_combats.defender_id", characterId);
        });

      if (cursor) {
        query = query.where("pvp_combats.created_at", "<", new Date(cursor));
      }

      return (await query
        .orderBy("pvp_combats.created_at", "desc")
        .limit(limit + 1)) as unknown as PvpCombatJoinedRow[];
    },

    async countAttacksSince(attackerId, defenderId, since, tx = q) {
      const rows = await tx("pvp_combats")
        .count("* as n")
        .where("attacker_id", attackerId)
        .where("defender_id", defenderId)
        .where("created_at", ">=", since);
      return Number((rows[0] as { n?: string | number } | undefined)?.n ?? 0);
    },

    async countDefeatsSince(characterId, since, tx = q) {
      const rows = await tx("pvp_combats")
        .count("* as n")
        .where(function () {
          this.where("attacker_id", characterId).orWhere("defender_id", characterId);
        })
        .whereNot("winner_id", characterId)
        .where("created_at", ">=", since);
      return Number((rows[0] as { n?: string | number } | undefined)?.n ?? 0);
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const pvpRepository = createPvpRepository();
