import { db, type Queryable } from "../db";
import { AppError } from "../middleware/error-handler";
import { isUniqueViolation } from "../db/pg-errors";

// Neon Dusk — Character repository (#158 DB repository layer)
// ============================================================================
// All `characters` table access. Write methods that can race (NIL, humanity,
// Moral) keep their optimistic WHERE guards here so callers preserve
// the existing concurrency contracts.

/** Database row shape for the `characters` table (snake_case columns). */
export interface CharacterRow {
  id: string;
  user_id: string;
  name: string;
  origin: string;
  role: string;
  body: number;
  reflexes: number;
  intelligence: number;
  technical: number;
  cool: number;
  street_cred: number;
  max_street_cred_achieved: number;
  last_activity_at: Date;
  nil: number;
  max_nil: number;
  nil_updated_at: Date;
  humanity: number;
  is_banned: boolean;
  ability_active_until: Date | null;
  ability_cooldown_until: Date | null;
  crew_id: string | null;
  os_ability_id: string | null;
  os_ability_active_until: Date | null;
  os_ability_uses_today: number;
  os_ability_used_date: Date | null;
  is_flatlined: boolean;
  flatlined_at: Date | null;
  humanity_updated_at: Date;
  created_at: Date;
  updated_at: Date;
}

/** Insert input for a new character (columns with DB defaults are optional). */
export interface CharacterInsert {
  user_id: string;
  name: string;
  origin: string;
  role: string;
  body?: number;
  reflexes?: number;
  intelligence?: number;
  technical?: number;
  cool?: number;
  max_nil?: number;
  street_cred?: number;
  humanity?: number;
}

/** Row shape for the Legends-induction candidates query (round reset). */
export interface LegendCandidateRow {
  character_name: string;
  crew_name: string | null;
}

/** Row shape for the admin players listing. */
export interface AdminPlayerRow {
  id: string;
  userId: string;
  name: string;
  streetCred: number | string;
  isBanned: boolean;
  balance: number | string | null;
  crewName: string | null;
  lastEvent: string | null;
}

export interface CharacterRepository {
  findById(id: string, q?: Queryable): Promise<CharacterRow | null>;
  /** Select with FOR UPDATE — locks the row for the transaction's duration. */
  findByIdForUpdate(id: string, q?: Queryable): Promise<CharacterRow | null>;
  findByUserId(userId: string, q?: Queryable): Promise<CharacterRow | null>;
  /** Find by user id or throw AppError(404 NO_CHARACTER). */
  requireByUserId(userId: string, q?: Queryable): Promise<CharacterRow>;
  /** Case-insensitive name lookup (backstop for the lower(name) unique index). */
  findNameTaken(name: string, q?: Queryable): Promise<{ id: string } | null>;
  insert(input: CharacterInsert, q?: Queryable): Promise<CharacterRow>;
  /** Plain street_cred write (decay writeback). */
  updateStreetCred(id: string, streetCred: number, q?: Queryable): Promise<void>;
  /** Wrap-up write — Moral + lifetime max + activity refresh. */
  updateStreetCredAndActivity(id: string, newScore: number, q?: Queryable): Promise<void>;
  /** PvP winner write — tracks the lifetime max only. */
  updateStreetCredMax(id: string, newScore: number, q?: Queryable): Promise<void>;
  /** PvP loser write — plain Moral delta. */
  updateStreetCredDelta(id: string, newScore: number, q?: Queryable): Promise<void>;
  /** PvP NIL cost — plain write. */
  updateNil(id: string, nil: number, q?: Queryable): Promise<void>;
  /**
   * NIL spend with optimistic lock: applies passive regen and deducts in one
   * UPDATE guarded by `nil >= rawNil` and the post-regen balance. Returns the
   * updated row, or undefined when the guard lost the race.
   */
  updateNilSpend(
    id: string,
    regenOffset: number,
    amount: number,
    rawNil: number,
    q?: Queryable,
  ): Promise<{ nil: number; max_nil: number; nil_updated_at: Date } | undefined>;
  /** Pingado restore — plain NIL write (vendor purchase path). */
  updateNilSet(id: string, nil: number, q?: Queryable): Promise<void>;
  /** Ampola restore with optimistic lock (`nil >= rawNil`), returning the row. */
  updateNilSetGuarded(
    id: string,
    nil: number,
    rawNil: number,
    q?: Queryable,
  ): Promise<{ nil: number; max_nil: number; nil_updated_at: Date } | undefined>;
  /** Humanity decrement guarded by `humanity >= cost` (concurrent install guard). */
  updateHumanityGuarded(id: string, humanity: number, cost: number, q?: Queryable): Promise<void>;
  /**
   * Humanity restore (therapy/consumable path) — plain write that also bumps
   * `humanity_updated_at` so the scrubber's lazy regen window restarts.
   */
  updateHumanity(id: string, humanity: number, q?: Queryable): Promise<void>;
  /** Recompute the effective NIL max after install/uninstall. */
  updateMaxNil(id: string, maxNil: number, q?: Queryable): Promise<void>;
  /** Role ability activation/consumption timestamps. */
  updateAbilityState(
    id: string,
    state: { activeUntil: Date | null; cooldownUntil: Date | null },
    q?: Queryable,
  ): Promise<void>;
  /** Set (or clear) the installed OS definition (install-time write). */
  setOsAbilityId(id: string, osAbilityId: string | null, q?: Queryable): Promise<void>;
  /** OS activation write: expiry + daily-charge counters (UTC-day aware). */
  updateOsActivation(
    id: string,
    state: { activeUntil: Date | null; usesToday: number; usedDate: Date | null },
    q?: Queryable,
  ): Promise<void>;
  /** Set (or clear) the crew affiliation. */
  setCrewId(id: string, crewId: string | null, q?: Queryable): Promise<void>;
  /** Dissolve cleanup — detach every member of a crew. */
  clearCrewForMembers(crewId: string, q?: Queryable): Promise<void>;
  /** Admin ban/unban. Returns the row id, or undefined when not found. */
  updateBan(id: string, isBanned: boolean, q?: Queryable): Promise<{ id: string } | undefined>;
  /** PvP candidate scan — base-power bracket in SQL, cromo filtered in JS. */
  listAttackableTargets(
    attackerId: string,
    opts: { minPower: number; maxPower: number; immunityCutoff: Date; limit: number },
    q?: Queryable,
  ): Promise<
    Array<{ id: string; name: string; streetCred: number; body: number; reflexes: number }>
  >;
  /** Admin dashboard player list (aggregated joins). */
  listAdminPlayers(
    opts: { offset: number; pageSize: number; search?: string; sort?: string },
    q?: Queryable,
  ): Promise<AdminPlayerRow[]>;
  /** Admin dashboard player count (same search filter). */
  countWithNameSearch(search: string | undefined, q?: Queryable): Promise<number>;
  /** Characters at Moral 100 (Legends induction candidates). */
  listLegendCandidates(q?: Queryable): Promise<LegendCandidateRow[]>;
  /** Leaderboard rows: decay inputs + crew name, ordered by Moral DESC. */
  listLeaderboardRows(limit: number, q?: Queryable): Promise<
    Array<{
      name: string;
      streetCred: number;
      maxStreetCredAchieved: number;
      lastActivityAt: Date;
      crewName: string | null;
    }>
  >;
  /** NIL snapshot for the Pingado restore (nil/max_nil/nil_updated_at). */
  findNilSnapshot(
    id: string,
    q?: Queryable,
  ): Promise<{ nil: number; max_nil: number; nil_updated_at: Date } | null>;
}

/** Escape SQL LIKE wildcards so user search input cannot match all records. */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function createCharacterRepository(q: Queryable = db): CharacterRepository {
  return {
    async findById(id, tx = q) {
      const rows = await tx("characters").select().where("id", id).limit(1);
      return rows.length ? (rows[0] as CharacterRow) : null;
    },

    async findByIdForUpdate(id, tx = q) {
      const rows = await tx("characters").select().where("id", id).forUpdate().limit(1);
      return rows.length ? (rows[0] as CharacterRow) : null;
    },

    async findByUserId(userId, tx = q) {
      const rows = await tx("characters").select().where("user_id", userId).limit(1);
      return rows.length ? (rows[0] as CharacterRow) : null;
    },

    async requireByUserId(userId, tx = q) {
      const rows = await tx("characters").select().where("user_id", userId).limit(1);
      if (!rows.length) {
        throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");
      }
      return rows[0] as CharacterRow;
    },

    async findNameTaken(name, tx = q) {
      const rows = await tx("characters")
        .select("id")
        .whereRaw("lower(name) = ?", [name.toLowerCase()])
        .limit(1);
      return rows.length ? (rows[0] as { id: string }) : null;
    },

    async insert(input, tx = q) {
      try {
        const [row] = await tx("characters").insert(input).returning("*");
        return row as CharacterRow;
      } catch (err) {
        // Safety net for the case-insensitive unique name index (lower(name)).
        if (isUniqueViolation(err)) {
          throw new AppError(409, "NAME_TAKEN", "Esse nome já está em uso");
        }
        throw err;
      }
    },

    async updateStreetCred(id, streetCred, tx = q) {
      await tx("characters")
        .update({ street_cred: streetCred, updated_at: new Date() })
        .where("id", id);
    },

    async updateStreetCredAndActivity(id, newScore, tx = q) {
      await tx("characters")
        .update({
          street_cred: newScore,
          max_street_cred_achieved: q.raw("GREATEST(max_street_cred_achieved, ?)", [newScore]),
          last_activity_at: q.fn.now(),
          updated_at: new Date(),
        })
        .where("id", id);
    },

    async updateStreetCredMax(id, newScore, tx = q) {
      await tx("characters")
        .update({
          street_cred: newScore,
          max_street_cred_achieved: q.raw("GREATEST(max_street_cred_achieved, ?)", [newScore]),
          updated_at: new Date(),
        })
        .where("id", id);
    },

    async updateStreetCredDelta(id, newScore, tx = q) {
      await tx("characters")
        .update({ street_cred: newScore, updated_at: new Date() })
        .where("id", id);
    },

    async updateNil(id, nil, tx = q) {
      await tx("characters")
        .update({ nil, updated_at: new Date() })
        .where("id", id);
    },

    async updateNilSpend(id, regenOffset, amount, rawNil, tx = q) {
      const rows = await tx("characters")
        .update({
          nil: q.raw("LEAST(max_nil, nil + ?) - ?", [regenOffset, amount]),
          nil_updated_at: new Date(),
        })
        .where("id", id)
        .where("nil", ">=", rawNil)
        .whereRaw("LEAST(max_nil, nil + ?) >= ?", [regenOffset, amount])
        .returning("*");
      return rows.length
        ? (rows[0] as { nil: number; max_nil: number; nil_updated_at: Date })
        : undefined;
    },

    async updateNilSet(id, nil, tx = q) {
      await tx("characters")
        .update({ nil, nil_updated_at: new Date() })
        .where("id", id);
    },

    async updateNilSetGuarded(id, nil, rawNil, tx = q) {
      const rows = await tx("characters")
        .update({ nil, nil_updated_at: new Date() })
        .where("id", id)
        .where("nil", ">=", rawNil)
        .returning("*");
      return rows.length
        ? (rows[0] as { nil: number; max_nil: number; nil_updated_at: Date })
        : undefined;
    },

    async updateHumanityGuarded(id, humanity, cost, tx = q) {
      await tx("characters")
        .update({ humanity, humanity_updated_at: new Date(), updated_at: new Date() })
        .where("id", id)
        .where("humanity", ">=", cost);
    },

    async updateHumanity(id, humanity, tx = q) {
      await tx("characters")
        .update({ humanity, humanity_updated_at: new Date(), updated_at: new Date() })
        .where("id", id);
    },

    async updateMaxNil(id, maxNil, tx = q) {
      await tx("characters")
        .update({ max_nil: maxNil, updated_at: new Date() })
        .where("id", id);
    },

    async updateAbilityState(id, state, tx = q) {
      await tx("characters")
        .update({
          ability_active_until: state.activeUntil,
          ability_cooldown_until: state.cooldownUntil,
          updated_at: new Date(),
        })
        .where("id", id);
    },

    async setOsAbilityId(id, osAbilityId, tx = q) {
      await tx("characters")
        .update({ os_ability_id: osAbilityId, updated_at: new Date() })
        .where("id", id);
    },

    async updateOsActivation(id, state, tx = q) {
      await tx("characters")
        .update({
          os_ability_active_until: state.activeUntil,
          os_ability_uses_today: state.usesToday,
          os_ability_used_date: state.usedDate,
          updated_at: new Date(),
        })
        .where("id", id);
    },

    async setCrewId(id, crewId, tx = q) {
      await tx("characters")
        .update({ crew_id: crewId, updated_at: new Date() })
        .where("id", id);
    },

    async clearCrewForMembers(crewId, tx = q) {
      await tx("characters")
        .update({ crew_id: null, updated_at: new Date() })
        .where("crew_id", crewId);
    },

    async updateBan(id, isBanned, tx = q) {
      const rows = await tx("characters")
        .update({ is_banned: isBanned })
        .where("id", id)
        .returning("id");
      return rows.length ? (rows[0] as { id: string }) : undefined;
    },

    async listAttackableTargets(attackerId, opts, tx = q) {
      return tx("characters")
        .select({
          id: "id",
          name: "name",
          streetCred: "street_cred",
          body: "body",
          reflexes: "reflexes",
        })
        .whereNot("id", attackerId)
        .where("created_at", "<", opts.immunityCutoff)
        .whereRaw("(body + reflexes) between ? and ?", [opts.minPower, opts.maxPower])
        .orderBy("street_cred", "desc")
        .limit(opts.limit) as Promise<
        Array<{ id: string; name: string; streetCred: number; body: number; reflexes: number }>
      >;
    },

    async listAdminPlayers(opts, tx = q) {
      let query = tx("characters")
        .select({
          id: "characters.id",
          userId: "characters.user_id",
          name: "characters.name",
          streetCred: "characters.street_cred",
          isBanned: "characters.is_banned",
          balance: q.raw("COALESCE(cw.balance, 0)"),
          crewName: "c.crew_name",
          lastEvent: q.raw("le.last_event::text"),
        })
        .leftJoin(
          tx("character_wallets").select("character_id", "balance").as("cw"),
          "cw.character_id",
          "characters.id",
        )
        .leftJoin(
          tx("crew_members")
            .select("crew_members.character_id", "crews.name as crew_name")
            .join("crews", "crews.id", "crew_members.crew_id")
            .as("c"),
          "c.character_id",
          "characters.id",
        )
        .leftJoin(
          tx("game_events")
            .select({
              character_id: "actor_id",
              last_event: q.raw("max(game_events.created_at)"),
            })
            .whereNotNull("actor_id")
            .groupBy("actor_id")
            .as("le"),
          "le.character_id",
          "characters.id",
        );

      if (opts.search) {
        const safe = escapeLike(opts.search.toLowerCase());
        query = query.whereRaw("lower(characters.name) LIKE ?", [`%${safe}%`]);
      }

      // Sort order — validated enum from the service ("name" | "level" | "last_activity" | other).
      const orderCol =
        opts.sort === "name"
          ? "characters.name"
          : opts.sort === "last_activity"
            ? "characters.created_at"
            : "characters.street_cred";

      return (await query
        .orderBy(orderCol, "desc")
        .limit(opts.pageSize)
        .offset(opts.offset)) as unknown as AdminPlayerRow[];
    },

    async countWithNameSearch(search, tx = q) {
      let query = tx("characters");
      if (search) {
        const safe = escapeLike(search.toLowerCase());
        query = query.whereRaw("lower(characters.name) LIKE ?", [`%${safe}%`]);
      }
      const rows = await query.count("* as count");
      return Number((rows[0] as { count?: string | number } | undefined)?.count ?? 0);
    },

    async listLegendCandidates(tx = q) {
      const result = await tx.raw(`
        SELECT ch."name" AS "character_name", c."name" AS "crew_name"
        FROM "characters" ch
        LEFT JOIN "crews" c ON c."id" = ch."crew_id"
        WHERE ch."street_cred" = 100
      `);
      return result.rows as LegendCandidateRow[];
    },

    async listLeaderboardRows(limit, tx = q) {
      return (await tx("characters")
        .select({
          name: "characters.name",
          streetCred: "characters.street_cred",
          maxStreetCredAchieved: "characters.max_street_cred_achieved",
          lastActivityAt: "characters.last_activity_at",
          crewName: "crews.name",
        })
        .leftJoin("crews", "crews.id", "characters.crew_id")
        .orderBy("characters.street_cred", "desc")
        .limit(limit)) as unknown as Array<{
        name: string;
        streetCred: number;
        maxStreetCredAchieved: number;
        lastActivityAt: Date;
        crewName: string | null;
      }>;
    },

    async findNilSnapshot(id, tx = q) {
      const rows = await tx("characters")
        .select("nil", "max_nil", "nil_updated_at")
        .where("id", id)
        .limit(1);
      return rows.length
        ? (rows[0] as { nil: number; max_nil: number; nil_updated_at: Date })
        : null;
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const characterRepository = createCharacterRepository();
