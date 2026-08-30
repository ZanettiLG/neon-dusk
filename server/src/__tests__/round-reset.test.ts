import { describe, it, expect } from "vitest";
import {
  UNNAMED_DRINK,
  buildLegendInserts,
  buildResetQueries,
  calculateRoundStats,
  RESET_CHARACTERS_STEP,
} from "../game/round-reset";

// ND-017 — unit tests for round reset game logic (pure functions, no DB).
// The service layer (round-service.ts) executes the generated SQL inside a
// single transaction; here we only assert the pure generators.

// ─── buildResetQueries ──────────────────────────────────────────────────────

describe("buildResetQueries", () => {
  it("returns the 19-step reset sequence in the correct order", () => {
    const steps = buildResetQueries();
    expect(steps.map((s) => s.description)).toEqual([
      "capture_round_stats",
      "insert_round_stats",
      "end_current_round",
      "wipe_active_gigs",
      "wipe_gig_history",
      "wipe_installed_chrome",
      "wipe_therapy_sessions",
      "wipe_character_consumables",
      "wipe_consumable_uses",
      "wipe_pvp_combats",
      "wipe_heat",
      "wipe_transaction_log",
      "wipe_crew_invites",
      "wipe_crew_members",
      "detach_crew_membership",
      "wipe_crews",
      "zero_wallets",
      RESET_CHARACTERS_STEP,
      "start_next_round",
    ]);
  });

  it("captures stats before any wipe", () => {
    const steps = buildResetQueries();
    const captureIdx = steps.findIndex((s) => s.description === "capture_round_stats");
    const wipeIdx = steps.findIndex((s) => s.description === "wipe_active_gigs");
    expect(captureIdx).toBeLessThan(wipeIdx);
  });

  it("persists stats before the round is closed", () => {
    const steps = buildResetQueries();
    const insertIdx = steps.findIndex((s) => s.description === "insert_round_stats");
    const endIdx = steps.findIndex((s) => s.description === "end_current_round");
    expect(insertIdx).toBeLessThan(endIdx);
  });

  it("zeroes wallets before resetting characters", () => {
    const steps = buildResetQueries();
    const walletIdx = steps.findIndex((s) => s.description === "zero_wallets");
    const charIdx = steps.findIndex((s) => s.description === RESET_CHARACTERS_STEP);
    expect(walletIdx).toBeLessThan(charIdx);
  });

  it("opens the next round last", () => {
    const steps = buildResetQueries();
    expect(steps[steps.length - 1].description).toBe("start_next_round");
    expect(steps[steps.length - 1].sql).toContain("'active'");
  });

  it("every step has a description and non-empty single-statement SQL", () => {
    for (const step of buildResetQueries()) {
      expect(step.description).toBeTruthy();
      expect(step.sql).toBeTruthy();
      // Single statement — drizzle execute must not receive multi-statement strings.
      expect(step.sql.split(";").filter((s) => s.trim())).toHaveLength(1);
    }
  });

  it("wipes crews after detaching characters", () => {
    const steps = buildResetQueries();
    const detachIdx = steps.findIndex((s) => s.description === "detach_crew_membership");
    const wipeIdx = steps.findIndex((s) => s.description === "wipe_crews");
    expect(detachIdx).toBeLessThan(wipeIdx);
  });

  it("honors a custom intermission for the next round start", () => {
    const step = buildResetQueries({ intermissionMinutes: 90 }).at(-1)!;
    expect(step.sql).toContain("90 * interval '1 minute'");
  });
});

// ─── calculateRoundStats ────────────────────────────────────────────────────

describe("calculateRoundStats", () => {
  it("maps raw aggregates to a snapshot", () => {
    const result = calculateRoundStats({
      totalGigsCompleted: 42,
      totalEddiesEarned: 10000,
      totalPvpFights: 7,
      totalActiveCharacters: 200,
      topCrew: { name: "Os Sem Rosto", score: 150 },
      topScCharacter: { name: "Razorback", score: 95 },
    });
    expect(result).toEqual({
      totalGigsCompleted: 42,
      totalEddiesEarned: 10000,
      totalPvpFights: 7,
      totalActiveCharacters: 200,
      topCrewName: "Os Sem Rosto",
      topScCharacterName: "Razorback",
      topScValue: 95,
    });
  });

  it("handles missing top crew/character", () => {
    const result = calculateRoundStats({
      totalGigsCompleted: 0,
      totalEddiesEarned: 0,
      totalPvpFights: 0,
      totalActiveCharacters: 0,
      topCrew: null,
      topScCharacter: null,
    });
    expect(result.topCrewName).toBeNull();
    expect(result.topScCharacterName).toBeNull();
    expect(result.topScValue).toBeNull();
  });
});

// ─── buildLegendInserts ─────────────────────────────────────────────────────

describe("buildLegendInserts", () => {
  it("returns null for no candidates", () => {
    expect(buildLegendInserts([])).toBeNull();
  });

  it("generates a multi-row INSERT with the unnamed drink placeholder", () => {
    const step = buildLegendInserts([
      { characterName: "Razorback", crewName: null, roundNumber: 2 },
      { characterName: "Ghostwire", crewName: "Os Sem Rosto", roundNumber: 2 },
    ]);
    expect(step).not.toBeNull();
    expect(step!.description).toBe("preserve_legends");
    expect(step!.sql).toContain('INSERT INTO "legends"');
    expect(step!.sql).toContain(`'Razorback', '${UNNAMED_DRINK}'`);
    expect(step!.sql).toContain("'Ghostwire', '");
    expect(step!.sql).toContain("'Os Sem Rosto'");
    // NULL crew → SQL NULL literal, not the string "null".
    expect(step!.sql).toContain("now(), NULL)");
  });

  it("escapes single quotes in character and crew names", () => {
    const step = buildLegendInserts([
      { characterName: "O'Malley", crewName: "Irmandade d'Osso", roundNumber: 2 },
    ]);
    expect(step!.sql).toContain("'O''Malley'");
    expect(step!.sql).toContain("'Irmandade d''Osso'");
  });

  it("produces one value tuple per candidate", () => {
    const step = buildLegendInserts([
      { characterName: "A", crewName: null, roundNumber: 2 },
      { characterName: "B", crewName: null, roundNumber: 2 },
      { characterName: "C", crewName: null, roundNumber: 2 },
    ]);
    // One tuple per candidate; escaped names never contain raw "), (" splits
    // beyond the tuples themselves.
    expect(step!.sql.match(/\), \(/g)).toHaveLength(2);
  });
});
