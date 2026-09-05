import { db, type Queryable } from "../db";

// Neon Dusk — Trampo repository (#158 DB repository layer)
// ============================================================================
// `gigs` / `active_gigs` / `gig_history` access. Phase transitions are plain UPDATE
// statements — the phase state machine itself lives in game/gigs.ts.

/** Raw row shape for `gigs`. */
export interface GigRow {
  id: string;
  name: string;
  description: string;
  tier: string;
  type: string;
  district: string;
  difficulty: number;
  escape_difficulty: number;
  required_stats: Record<string, number>;
  required_street_cred: number;
  base_reward: number;
  nil_cost: number;
  heat_generated: number;
  legwork_minutes: number;
  cooldown_seconds: number;
  created_at: Date;
}

/** Row shape of an active_gigs ⋈ `gigs` join. */
export interface ActiveGigJoinedRow {
  id: string;
  gigId: string;
  gigName: string;
  gigType: string;
  gigTier: string;
  phase: string;
  status: string;
  acceptedAt: Date;
  legworkStartedAt: Date | null;
  legworkCompleted: boolean;
  legworkMinutes: number;
  executeOutcome: string | null;
  escapeOutcome: string | null;
  actualPayout: number | null;
  escapeDifficulty: number;
}

/** Raw row shape for `active_gigs`. */
export interface ActiveGigRow {
  id: string;
  character_id: string;
  gig_id: string;
  phase: string;
  status: string;
  accepted_at: Date;
  legwork_started_at: Date | null;
  legwork_completed: boolean;
  execute_outcome: string | null;
  escape_outcome: string | null;
  actual_payout: number | null;
  created_at: Date;
  updated_at: Date;
}

/** Patchable columns for a phase transition. */
export interface ActiveGigPatch {
  phase?: string;
  legwork_started_at?: Date | null;
  legwork_completed?: boolean;
  execute_outcome?: string | null;
  escape_outcome?: string | null;
  actual_payout?: number | null;
  updated_at?: Date;
}

/** Insert input for gig_history. */
export interface GigHistoryInsert {
  character_id: string;
  gig_id: string;
  outcome: string;
  phases_completed: string[];
  payout?: number;
  street_cred_gained?: number;
  heat_accumulated?: number;
  district: string;
}

/** Joined history row (gig_history ⋈ `gigs`). */
export interface GigHistoryJoinedRow {
  id: string;
  gigId: string;
  gigName: string;
  tier: string;
  type: string;
  outcome: string;
  payout: number;
  streetCredGained: number;
  heatAccumulated: number;
  district: string;
  completedAt: Date;
}

/** Columns shared by the active-trampo queries (active_gigs ⋈ `gigs`). */
function activeGigSelect(tx: Queryable) {
  return tx("active_gigs")
    .select({
      id: "active_gigs.id",
      gigId: "active_gigs.gig_id",
      gigName: "gigs.name",
      gigType: "gigs.type",
      gigTier: "gigs.tier",
      phase: "active_gigs.phase",
      status: "active_gigs.status",
      acceptedAt: "active_gigs.accepted_at",
      legworkStartedAt: "active_gigs.legwork_started_at",
      legworkCompleted: "active_gigs.legwork_completed",
      legworkMinutes: "gigs.legwork_minutes",
      executeOutcome: "active_gigs.execute_outcome",
      escapeOutcome: "active_gigs.escape_outcome",
      actualPayout: "active_gigs.actual_payout",
      escapeDifficulty: "gigs.escape_difficulty",
    })
    .join("gigs", "active_gigs.gig_id", "gigs.id");
}

export interface GigRepository {
  /** Full trampo catalog ordered by tier, then difficulty. */
  listCatalog(q?: Queryable): Promise<GigRow[]>;
  /** One trampo template by id. */
  findById(id: string, q?: Queryable): Promise<GigRow | null>;
  /** The character's active trampo joined with its template, or null. */
  findActiveGig(characterId: string, q?: Queryable): Promise<ActiveGigJoinedRow | null>;
  /**
   * Open an active trampo (INSERT with unique(character_id) ON CONFLICT DO
   * NOTHING — a concurrent accept loses the race here). Returns undefined
   * when the character already has an active trampo.
   */
  openActiveGig(
    characterId: string,
    gigId: string,
    q?: Queryable,
  ): Promise<ActiveGigRow | undefined>;
  /** Delete one active trampo (acceptGig rollback path). */
  deleteActiveGig(id: string, q?: Queryable): Promise<void>;
  /** Count the character's active trampos (Long Haul check). */
  countActiveGigs(characterId: string, q?: Queryable): Promise<number>;
  /** Phase transition / outcome write on an active trampo. */
  transitionActiveGig(id: string, patch: ActiveGigPatch, q?: Queryable): Promise<void>;
  /** Close the active trampo (wrap-up terminal step). */
  closeActiveGig(id: string, q?: Queryable): Promise<void>;
  /** Raw active_gigs row for (character, trampo) — abandon path. */
  findActiveGigByGig(
    characterId: string,
    gigId: string,
    q?: Queryable,
  ): Promise<ActiveGigRow | null>;
  /** Delete every active trampo of a character (abandon path). */
  closeActiveGigsForCharacter(characterId: string, q?: Queryable): Promise<void>;
  /** Trampo district (history entry for abandoned trampos). */
  findDistrict(gigId: string, q?: Queryable): Promise<{ district: string } | null>;
  /** Last completion timestamp per trampo template (board cooldowns). */
  listLastCompletions(
    characterId: string,
    q?: Queryable,
  ): Promise<Array<{ gigId: string; lastAt: Date }>>;
  /** Most recent completion of one trampo template. */
  findLastCompletion(
    characterId: string,
    gigId: string,
    q?: Queryable,
  ): Promise<{ lastAt: Date } | null>;
  /** Append a gig_history row. */
  insertHistory(entry: GigHistoryInsert, q?: Queryable): Promise<void>;
  /** History page (joined with templates), +1 row for pagination detection. */
  listHistory(
    characterId: string,
    limit: number,
    cursor: string | undefined,
    q?: Queryable,
  ): Promise<GigHistoryJoinedRow[]>;
}

export function createGigRepository(q: Queryable = db): GigRepository {
  return {
    async listCatalog(tx = q) {
      return (await tx("gigs")
        .select()
        .orderBy("tier", "asc")
        .orderBy("difficulty", "asc")) as GigRow[];
    },

    async findById(id, tx = q) {
      const rows = await tx("gigs").select().where("id", id).limit(1);
      return rows.length ? (rows[0] as GigRow) : null;
    },

    async findActiveGig(characterId, tx = q) {
      const rows = (await activeGigSelect(tx)
        .where("active_gigs.character_id", characterId)
        .limit(1)) as unknown as ActiveGigJoinedRow[];
      return rows[0] ?? null;
    },

    async openActiveGig(characterId, gigId, tx = q) {
      const rows = await tx("active_gigs")
        .insert({ character_id: characterId, gig_id: gigId })
        .onConflict("character_id")
        .ignore()
        .returning("*");
      return rows.length ? (rows[0] as ActiveGigRow) : undefined;
    },

    async deleteActiveGig(id, tx = q) {
      await tx("active_gigs").delete().where("id", id);
    },

    async countActiveGigs(characterId, tx = q) {
      const rows = await tx("active_gigs").count("* as count").where("character_id", characterId);
      return Number((rows[0] as { count?: string | number } | undefined)?.count ?? 0);
    },

    async transitionActiveGig(id, patch, tx = q) {
      await tx("active_gigs").update(patch).where("id", id);
    },

    async closeActiveGig(id, tx = q) {
      await tx("active_gigs").delete().where("id", id);
    },

    async findActiveGigByGig(characterId, gigId, tx = q) {
      const rows = await tx("active_gigs")
        .select()
        .where("character_id", characterId)
        .where("gig_id", gigId)
        .limit(1);
      return rows.length ? (rows[0] as ActiveGigRow) : null;
    },

    async closeActiveGigsForCharacter(characterId, tx = q) {
      await tx("active_gigs").delete().where("character_id", characterId);
    },

    async findDistrict(gigId, tx = q) {
      const rows = await tx("gigs").select("district").where("id", gigId).limit(1);
      return rows.length ? (rows[0] as { district: string }) : null;
    },

    async listLastCompletions(characterId, tx = q) {
      return (
        (await tx("gig_history")
          .select({ gigId: "gig_id", lastAt: tx.raw("max(completed_at)") })
          .where("character_id", characterId)
          // Issue #2: abandoned trampos never start cooldowns — only real
          // completions (success/failure) count. Failure keeps its cooldown
          // (anti-farm), per the follow-up design.
          .whereNot("outcome", "abandoned")
          .groupBy("gig_id")) as unknown as Array<{ gigId: string; lastAt: Date }>
      );
    },

    async findLastCompletion(characterId, gigId, tx = q) {
      const rows = await tx("gig_history")
        .select("completed_at as lastAt")
        .where("character_id", characterId)
        .where("gig_id", gigId)
        .whereNot("outcome", "abandoned")
        .orderBy("completed_at", "desc")
        .limit(1);
      return rows.length ? (rows[0] as { lastAt: Date }) : null;
    },

    async insertHistory(entry, tx = q) {
      await tx("gig_history").insert(entry);
    },

    async listHistory(characterId, limit, cursor, tx = q) {
      let query = tx("gig_history")
        .select({
          id: "gig_history.id",
          gigId: "gig_history.gig_id",
          gigName: "gigs.name",
          tier: "gigs.tier",
          type: "gigs.type",
          outcome: "gig_history.outcome",
          payout: "gig_history.payout",
          streetCredGained: "gig_history.street_cred_gained",
          heatAccumulated: "gig_history.heat_accumulated",
          district: "gig_history.district",
          completedAt: "gig_history.completed_at",
        })
        .join("gigs", "gig_history.gig_id", "gigs.id")
        .where("gig_history.character_id", characterId);

      if (cursor) {
        query = query.where("gig_history.completed_at", "<", new Date(cursor));
      }

      return (await query
        .orderBy("gig_history.completed_at", "desc")
        .limit(limit + 1)) as unknown as GigHistoryJoinedRow[];
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const gigRepository = createGigRepository();
