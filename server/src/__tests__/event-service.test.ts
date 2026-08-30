import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db";
import { insertTestCharacter, resetDb } from "./helpers";
import { listCharacterEvents, severityFor } from "../services/event-service";
import { GAME_EVENT_TYPES } from "@neon-dusk/shared";
import type { CharacterEventSeverity, GameEventType } from "@neon-dusk/shared";

// ND-139 — event feed service: severityFor mapping + cursor-paginated
// listCharacterEvents. Service-level (no HTTP) against the real test Postgres;
// rows are inserted directly so ordering/timestamps are deterministic.

/** Source-of-truth severity table (docs/definicoes-de-produto + issue #139). */
const SEVERITY_MAP: [GameEventType, CharacterEventSeverity][] = [
  ["CHARACTER_CREATED", "info"],
  ["GIG_STARTED", "info"],
  ["GIG_COMPLETED", "success"],
  ["GIG_FAILED", "danger"],
  ["PVP_ATTACK", "warning"],
  ["PVP_DEFEAT", "danger"],
  ["EDDIES_EARNED", "success"],
  ["EDDIES_SPENT", "info"],
  ["NIL_SPENT", "warning"],
  ["NIL_RESTORED", "success"],
  ["VENDOR_PURCHASE", "info"],
  ["ABILITY_ACTIVATED", "success"],
  ["ABILITY_CONSUMED", "info"],
  // Issue #28 — cromo incompleto (OS, terapia, itens anti-insanidade).
  ["OS_ACTIVATED", "success"],
  ["THERAPY_COMPLETED", "success"],
  ["HUMANITY_RESTORED", "success"],
];

describe("severityFor", () => {
  it("should map every one of the 16 event types to its exact severity", () => {
    for (const [type, expected] of SEVERITY_MAP) {
      expect(severityFor(type)).toBe(expected);
    }
  });

  it("should cover every GameEventType in the shared enum (no drift)", () => {
    const mapped = SEVERITY_MAP.map(([type]) => type).sort();
    expect(mapped).toEqual([...GAME_EVENT_TYPES].sort());
  });
});

describe("listCharacterEvents", () => {
  beforeEach(async () => {
    await resetDb();
    // game_events has no FK to characters (actor_id is FK-less), so the
    // resetDb TRUNCATE doesn't touch it — clear it explicitly.
    await db.raw("TRUNCATE TABLE game_events");
  });

  /** Insert a raw game_events row for the given character at a fixed time. */
  async function seedEvent(
    characterId: string,
    eventType: GameEventType,
    createdAt: Date,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await db("game_events").insert({
      event_type: eventType,
      actor_id: characterId,
      payload,
      created_at: createdAt,
    });
  }

  it("should return only the character's own events, newest first, with mapped severity", async () => {
    const a = await insertTestCharacter();
    const b = await insertTestCharacter();
    const t1 = new Date("2026-08-01T10:00:00.000Z");
    const t2 = new Date("2026-08-02T10:00:00.000Z");
    const t3 = new Date("2026-08-03T10:00:00.000Z");
    await seedEvent(a.characterId, "GIG_FAILED", t1, { gigName: "Antiga" });
    await seedEvent(a.characterId, "NIL_SPENT", t2, { amount: 20 });
    await seedEvent(a.characterId, "GIG_COMPLETED", t3, { gigName: "Nova", payout: 550 });
    // B's event is the newest of all — it would sort first if the actor
    // filter leaked.
    await seedEvent(b.characterId, "EDDIES_EARNED", new Date("2026-08-04T10:00:00.000Z"), { amount: 999 });

    const result = await listCharacterEvents(a.characterId, 10);

    expect(result.events.map((e) => e.eventType)).toEqual([
      "GIG_COMPLETED",
      "NIL_SPENT",
      "GIG_FAILED",
    ]);
    // Newest first.
    const times = result.events.map((e) => new Date(e.createdAt).getTime());
    expect(times).toEqual([...times].sort((x, y) => y - x));
    // Severity matches the mapping; payload survives the round-trip.
    expect(result.events[0]).toMatchObject({
      eventType: "GIG_COMPLETED",
      severity: "success",
      payload: { gigName: "Nova", payout: 550 },
    });
    expect(result.events[1].severity).toBe("warning");
    expect(result.events[2].severity).toBe("danger");
    // No cross-character leakage.
    expect(result.events.some((e) => e.eventType === "EDDIES_EARNED")).toBe(false);
    // Each event carries the full CharacterEvent shape.
    for (const event of result.events) {
      expect(typeof event.id).toBe("string");
      expect(event.id.length).toBeGreaterThan(0);
      expect(new Date(event.createdAt).getTime()).not.toBeNaN();
    }
    expect(result.nextCursor).toBeNull();
  });

  it("should respect the limit and return nextCursor when more pages exist", async () => {
    const { characterId } = await insertTestCharacter();
    const times = [
      "2026-08-01T10:00:00.000Z",
      "2026-08-02T10:00:00.000Z",
      "2026-08-03T10:00:00.000Z",
      "2026-08-04T10:00:00.000Z",
      "2026-08-05T10:00:00.000Z",
    ];
    for (const t of times) {
      await seedEvent(characterId, "EDDIES_EARNED", new Date(t), { amount: 1 });
    }

    const result = await listCharacterEvents(characterId, 2);

    expect(result.events).toHaveLength(2);
    expect(result.events.map((e) => e.createdAt)).toEqual([times[4], times[3]]);
    // Cursor is the newest-ish bound: the createdAt of the last returned event.
    expect(result.nextCursor).toBe(times[3]);
  });

  it("should return nextCursor null when the last page is reached", async () => {
    const { characterId } = await insertTestCharacter();
    for (const t of ["2026-08-01T10:00:00.000Z", "2026-08-02T10:00:00.000Z", "2026-08-03T10:00:00.000Z"]) {
      await seedEvent(characterId, "GIG_STARTED", new Date(t));
    }

    const exact = await listCharacterEvents(characterId, 3);
    expect(exact.events).toHaveLength(3);
    expect(exact.nextCursor).toBeNull();

    const over = await listCharacterEvents(characterId, 10);
    expect(over.events).toHaveLength(3);
    expect(over.nextCursor).toBeNull();
  });

  it("should walk every page via the cursor without overlap or gaps", async () => {
    const { characterId } = await insertTestCharacter();
    const times = [
      "2026-08-01T10:00:00.000Z",
      "2026-08-02T10:00:00.000Z",
      "2026-08-03T10:00:00.000Z",
      "2026-08-04T10:00:00.000Z",
      "2026-08-05T10:00:00.000Z",
    ];
    for (const t of times) {
      await seedEvent(characterId, "VENDOR_PURCHASE", new Date(t));
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    let page = 0;
    do {
      const result = await listCharacterEvents(characterId, 2, cursor);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events.length).toBeLessThanOrEqual(2);
      // Strictly older than the previous page (cursor is `created_at < cursor`).
      if (page > 0) {
        const prev = new Date(seen[seen.length - 1]).getTime();
        for (const event of result.events) {
          expect(new Date(event.createdAt).getTime()).toBeLessThan(prev);
        }
      }
      for (const event of result.events) {
        expect(seen).not.toContain(event.createdAt); // no duplicates
        seen.push(event.createdAt);
      }
      cursor = result.nextCursor ?? undefined;
      page += 1;
    } while (cursor !== undefined);

    expect(page).toBe(3);
    expect(seen).toEqual([...times].reverse()); // all 5 rows, newest first
  });

  it("should skip older events when a cursor is passed", async () => {
    const { characterId } = await insertTestCharacter();
    await seedEvent(characterId, "GIG_STARTED", new Date("2026-08-01T10:00:00.000Z"));
    await seedEvent(characterId, "GIG_STARTED", new Date("2026-08-02T10:00:00.000Z"));
    await seedEvent(characterId, "GIG_STARTED", new Date("2026-08-03T10:00:00.000Z"));

    // Cursor at the middle event → only the oldest event remains.
    const result = await listCharacterEvents(characterId, 10, "2026-08-02T10:00:00.000Z");

    expect(result.events).toHaveLength(1);
    expect(result.events[0].createdAt).toBe("2026-08-01T10:00:00.000Z");
    expect(result.nextCursor).toBeNull();
  });

  it("should return an empty page for a character with no events", async () => {
    const { characterId } = await insertTestCharacter();

    const result = await listCharacterEvents(characterId, 10);

    expect(result).toEqual({ events: [], nextCursor: null });
  });
});
