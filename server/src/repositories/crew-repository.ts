import { db, type Queryable } from "../db";

// Neon Dusk — Crew repository (#158 DB repository layer)
// ============================================================================
// crews / crew_members / crew_invites access. The 4-member cap is enforced
// by the trg_crew_member_limit DB trigger; app-level checks are UX.

/** Raw row shape for `crews`. */
export interface CrewRow {
  id: string;
  name: string;
  tag: string;
  leader_id: string;
  created_at: Date;
}

/** Raw row shape for `crew_members`. */
export interface CrewMemberRow {
  id: string;
  crew_id: string;
  character_id: string;
  joined_at: Date;
}

/** Raw row shape for `crew_invites`. */
export interface CrewInviteRow {
  id: string;
  crew_id: string;
  character_id: string;
  invited_by: string;
  created_at: Date;
  expires_at: Date;
}

/** Member row joined with the character (name + street cred). */
export interface CrewMemberJoinedRow {
  id: string;
  characterId: string;
  characterName: string;
  streetCred: number;
  joinedAt: Date;
}

export interface CrewRepository {
  findById(id: string, q?: Queryable): Promise<CrewRow | null>;
  findByName(name: string, q?: Queryable): Promise<CrewRow | null>;
  findByTag(tag: string, q?: Queryable): Promise<CrewRow | null>;
  /** Crew tag only (chat message decoration). */
  findTagById(id: string, q?: Queryable): Promise<{ tag: string } | null>;
  insert(input: { name: string; tag: string; leader_id: string }, q?: Queryable): Promise<CrewRow>;
  delete(crewId: string, q?: Queryable): Promise<void>;
  /** Every crew with its member count (board listing). */
  listAllWithMemberCount(q?: Queryable): Promise<
    Array<{ id: string; name: string; tag: string; leaderId: string; memberCount: number }>
  >;
  /** Crew ranking by total member street cred (detail view). */
  listRanking(q?: Queryable): Promise<Array<{ id: string; totalSC: number }>>;
  /** Top crews by total member SC (Saideira leaderboard). */
  listLeaderboard(limit: number, q?: Queryable): Promise<
    Array<{ name: string; totalSC: number; memberCount: number }>
  >;
  /** Crew members joined with character names, oldest join first. */
  listMembers(crewId: string, q?: Queryable): Promise<CrewMemberJoinedRow[]>;
  /** Current member count (the DB trigger enforces the hard cap). */
  memberCount(crewId: string, q?: Queryable): Promise<number>;
  /** Whether the character is a member of the crew. */
  hasMember(crewId: string, characterId: string, q?: Queryable): Promise<boolean>;
  /** Add a member (4-member cap enforced by the DB trigger). */
  insertMember(crewId: string, characterId: string, q?: Queryable): Promise<CrewMemberRow>;
  /** Remove one member (leave / kick). */
  removeMember(crewId: string, characterId: string, q?: Queryable): Promise<void>;
  /** Remove every member (dissolve). */
  removeAllMembers(crewId: string, q?: Queryable): Promise<void>;
  createInvite(
    input: { crew_id: string; character_id: string; invited_by: string; expires_at: Date },
    q?: Queryable,
  ): Promise<CrewInviteRow>;
  /** The pending invite for (crew, character). */
  findInvite(crewId: string, characterId: string, q?: Queryable): Promise<CrewInviteRow | null>;
  /** Delete one invite (accept + expired replacement paths). */
  deleteInvite(id: string, q?: Queryable): Promise<void>;
  /** Delete every invite of a crew (dissolve). */
  deleteInvitesForCrew(crewId: string, q?: Queryable): Promise<void>;
}

export function createCrewRepository(q: Queryable = db): CrewRepository {
  return {
    async findById(id, tx = q) {
      const rows = await tx("crews").select().where("id", id).limit(1);
      return rows.length ? (rows[0] as CrewRow) : null;
    },

    async findByName(name, tx = q) {
      const rows = await tx("crews").select().where("name", name).limit(1);
      return rows.length ? (rows[0] as CrewRow) : null;
    },

    async findByTag(tag, tx = q) {
      const rows = await tx("crews").select().where("tag", tag).limit(1);
      return rows.length ? (rows[0] as CrewRow) : null;
    },

    async findTagById(id, tx = q) {
      const rows = await tx("crews").select("tag").where("id", id).limit(1);
      return rows.length ? (rows[0] as { tag: string }) : null;
    },

    async insert(input, tx = q) {
      const rows = await tx("crews").insert(input).returning("*");
      return rows[0] as CrewRow;
    },

    async delete(crewId, tx = q) {
      await tx("crews").delete().where("id", crewId);
    },

    async listAllWithMemberCount(tx = q) {
      return (await tx("crews")
        .select({
          id: "crews.id",
          name: "crews.name",
          tag: "crews.tag",
          leaderId: "crews.leader_id",
          memberCount: q.raw(
            "(SELECT count(*)::int FROM crew_members WHERE crew_members.crew_id = crews.id)",
          ),
        })
        .orderBy("crews.created_at")) as unknown as Array<{
        id: string;
        name: string;
        tag: string;
        leaderId: string;
        memberCount: number;
      }>;
    },

    async listRanking(tx = q) {
      return (await tx("crews")
        .select({
          id: "crews.id",
          totalSC: q.raw("COALESCE(SUM(characters.street_cred), 0)::int"),
        })
        .leftJoin("crew_members", "crew_members.crew_id", "crews.id")
        .leftJoin("characters", "characters.id", "crew_members.character_id")
        .groupBy("crews.id")
        .orderByRaw("COALESCE(SUM(characters.street_cred), 0) DESC")) as unknown as Array<{
        id: string;
        totalSC: number;
      }>;
    },

    async listLeaderboard(limit, tx = q) {
      const totalSC = q.raw("COALESCE(SUM(characters.street_cred), 0)::int");
      return (await tx("crews")
        .select({
          name: "crews.name",
          totalSC,
          memberCount: q.raw("COUNT(crew_members.character_id)::int"),
        })
        .leftJoin("crew_members", "crew_members.crew_id", "crews.id")
        .leftJoin("characters", "characters.id", "crew_members.character_id")
        .groupBy("crews.id")
        .orderBy("totalSC", "desc")
        .limit(limit)) as unknown as Array<{
        name: string;
        totalSC: number;
        memberCount: number;
      }>;
    },

    async listMembers(crewId, tx = q) {
      return (await tx("crew_members")
        .select({
          id: "crew_members.id",
          characterId: "crew_members.character_id",
          characterName: "characters.name",
          streetCred: "characters.street_cred",
          joinedAt: "crew_members.joined_at",
        })
        .join("characters", "characters.id", "crew_members.character_id")
        .where("crew_members.crew_id", crewId)
        .orderBy("crew_members.joined_at")) as unknown as CrewMemberJoinedRow[];
    },

    async memberCount(crewId, tx = q) {
      const rows = await tx("crew_members")
        .count("* as count")
        .where("crew_id", crewId);
      return Number((rows[0] as { count?: string | number } | undefined)?.count ?? 0);
    },

    async hasMember(crewId, characterId, tx = q) {
      const rows = await tx("crew_members")
        .select("id")
        .where("crew_id", crewId)
        .where("character_id", characterId)
        .limit(1);
      return rows.length > 0;
    },

    async insertMember(crewId, characterId, tx = q) {
      const rows = await tx("crew_members")
        .insert({ crew_id: crewId, character_id: characterId })
        .returning("*");
      return rows[0] as CrewMemberRow;
    },

    async removeMember(crewId, characterId, tx = q) {
      await tx("crew_members")
        .delete()
        .where("crew_id", crewId)
        .where("character_id", characterId);
    },

    async removeAllMembers(crewId, tx = q) {
      await tx("crew_members").delete().where("crew_id", crewId);
    },

    async createInvite(input, tx = q) {
      const rows = await tx("crew_invites").insert(input).returning("*");
      return rows[0] as CrewInviteRow;
    },

    async findInvite(crewId, characterId, tx = q) {
      const rows = await tx("crew_invites")
        .select()
        .where("crew_id", crewId)
        .where("character_id", characterId)
        .limit(1);
      return rows.length ? (rows[0] as CrewInviteRow) : null;
    },

    async deleteInvite(id, tx = q) {
      await tx("crew_invites").delete().where("id", id);
    },

    async deleteInvitesForCrew(crewId, tx = q) {
      await tx("crew_invites").delete().where("crew_id", crewId);
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const crewRepository = createCrewRepository();
