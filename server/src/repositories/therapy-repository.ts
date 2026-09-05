import { db, type Queryable } from "../db";

// Neon Dusk — Therapy repository (#158 DB repository layer)
// ============================================================================
// `therapy_sessions` access: the 500ms anti-spam window (#187) is derived
// from the last session's `completed_at` (no denormalized column).

/** Raw row shape for `therapy_sessions`. */
export interface TherapySessionRow {
  id: string;
  character_id: string;
  therapy_type: string;
  cost: number;
  restored: number;
  humanity_before: number;
  humanity_after: number;
  completed_at: Date;
  created_at: Date;
}

export interface TherapyRepository {
  /** Most recent session of a character (cooldown lookup). */
  findLastSession(characterId: string, q?: Queryable): Promise<TherapySessionRow | null>;
  /** Append one session row. */
  insertSession(
    input: {
      character_id: string;
      therapy_type: string;
      cost: number;
      restored: number;
      humanity_before: number;
      humanity_after: number;
    },
    q?: Queryable,
  ): Promise<TherapySessionRow>;
}

export function createTherapyRepository(q: Queryable = db): TherapyRepository {
  return {
    async findLastSession(characterId, tx = q) {
      const rows = await tx("therapy_sessions")
        .select()
        .where("character_id", characterId)
        .orderBy("completed_at", "desc")
        .limit(1);
      return rows.length ? (rows[0] as TherapySessionRow) : null;
    },

    async insertSession(input, tx = q) {
      const rows = await tx("therapy_sessions")
        .insert({
          character_id: input.character_id,
          therapy_type: input.therapy_type,
          cost: input.cost,
          restored: input.restored,
          humanity_before: input.humanity_before,
          humanity_after: input.humanity_after,
        })
        .returning("*");
      return rows[0] as TherapySessionRow;
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const therapyRepository = createTherapyRepository();