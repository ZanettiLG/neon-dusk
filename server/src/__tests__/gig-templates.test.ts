import { describe, it, expect } from "vitest";
import { GIG_TEMPLATES } from "../content/gig-templates";
import type { GigType } from "../game/gigs";

// ND-011 — seed data integrity for the 19 hand-crafted gig templates (T1-T5).
// Guards the balance anchors from 03-mecanicas-core.md §2 and the DB CHECK
// constraints in schema.ts (gigs_*): any template that violates one of these
// would fail at INSERT time, so this suite catches drift before seeding.

const VALID_TYPES: readonly GigType[] = ["extraction", "delivery", "sabotage"];
const VALID_TIERS = ["t1", "t2", "t3", "t4", "t5"] as const;
const VALID_DISTRICTS = [
  "A Paraíso",
  "O Fervo",
  "O Fluxo",
  "A Quebrada",
  "Babilônia",
  "As Mortas",
  "O Ponto",
];
const VALID_ATTR_KEYS = ["body", "reflexes", "intelligence", "technical", "cool"];

describe("GIG_TEMPLATES", () => {
  it("should contain exactly 19 templates", () => {
    expect(GIG_TEMPLATES).toHaveLength(19);
  });

  it("should have 6 T1, 4 T2, 3 T3, 3 T4, and 3 T5 templates", () => {
    expect(GIG_TEMPLATES.filter((t) => t.tier === "t1")).toHaveLength(6);
    expect(GIG_TEMPLATES.filter((t) => t.tier === "t2")).toHaveLength(4);
    expect(GIG_TEMPLATES.filter((t) => t.tier === "t3")).toHaveLength(3);
    expect(GIG_TEMPLATES.filter((t) => t.tier === "t4")).toHaveLength(3);
    expect(GIG_TEMPLATES.filter((t) => t.tier === "t5")).toHaveLength(3);
  });

  it("should use only valid gig types with the designed distribution (7/6/6)", () => {
    for (const t of GIG_TEMPLATES) {
      expect(VALID_TYPES).toContain(t.type);
    }
    expect(GIG_TEMPLATES.filter((t) => t.type === "extraction")).toHaveLength(7);
    expect(GIG_TEMPLATES.filter((t) => t.type === "delivery")).toHaveLength(6);
    expect(GIG_TEMPLATES.filter((t) => t.type === "sabotage")).toHaveLength(6);
  });

  it("should use only valid tiers", () => {
    for (const t of GIG_TEMPLATES) {
      expect(VALID_TIERS).toContain(t.tier);
    }
  });

  it("should keep T1 rewards within 500-2000 de Grana", () => {
    for (const t of GIG_TEMPLATES.filter((t) => t.tier === "t1")) {
      expect(t.baseReward).toBeGreaterThanOrEqual(500);
      expect(t.baseReward).toBeLessThanOrEqual(2000);
    }
  });

  it("should keep T2 rewards within 2000-8000 de Grana", () => {
    for (const t of GIG_TEMPLATES.filter((t) => t.tier === "t2")) {
      expect(t.baseReward).toBeGreaterThanOrEqual(2000);
      expect(t.baseReward).toBeLessThanOrEqual(8000);
    }
  });

  it("should keep T3 rewards within 8000-20000 de Grana", () => {
    for (const t of GIG_TEMPLATES.filter((t) => t.tier === "t3")) {
      expect(t.baseReward).toBeGreaterThanOrEqual(8000);
      expect(t.baseReward).toBeLessThanOrEqual(20000);
    }
  });

  it("should keep T4 rewards within 20000-60000 de Grana", () => {
    for (const t of GIG_TEMPLATES.filter((t) => t.tier === "t4")) {
      expect(t.baseReward).toBeGreaterThanOrEqual(20000);
      expect(t.baseReward).toBeLessThanOrEqual(60000);
    }
  });

  it("should keep T5 rewards within 60000-200000 de Grana", () => {
    for (const t of GIG_TEMPLATES.filter((t) => t.tier === "t5")) {
      expect(t.baseReward).toBeGreaterThanOrEqual(60000);
      expect(t.baseReward).toBeLessThanOrEqual(200000);
    }
  });

  it("should use only valid districts and cover all seven of them", () => {
    const districts = new Set(GIG_TEMPLATES.map((t) => t.district));
    for (const t of GIG_TEMPLATES) {
      expect(VALID_DISTRICTS).toContain(t.district);
    }
    expect(districts.size).toBe(7);
    for (const d of VALID_DISTRICTS) {
      expect(districts.has(d)).toBe(true);
    }
  });

  it("should have a positive NIL cost on every template", () => {
    for (const t of GIG_TEMPLATES) {
      expect(t.nilCost).toBeGreaterThan(0);
    }
  });

  it("should use only valid attribute names in requiredStats", () => {
    for (const t of GIG_TEMPLATES) {
      for (const key of Object.keys(t.requiredStats)) {
        expect(VALID_ATTR_KEYS).toContain(key);
      }
    }
  });

  it("should require positive requiredStat values", () => {
    for (const t of GIG_TEMPLATES) {
      for (const value of Object.values(t.requiredStats)) {
        expect(value).toBeGreaterThan(0);
      }
    }
  });

  it("should gate T1 at SC 0, T2 at 5, T3 at 15, T4 at 30, T5 at 50", () => {
    for (const t of GIG_TEMPLATES.filter((t) => t.tier === "t1")) {
      expect(t.requiredStreetCred).toBe(0);
    }
    for (const t of GIG_TEMPLATES.filter((t) => t.tier === "t2")) {
      expect(t.requiredStreetCred).toBe(5);
    }
    for (const t of GIG_TEMPLATES.filter((t) => t.tier === "t3")) {
      expect(t.requiredStreetCred).toBe(15);
    }
    for (const t of GIG_TEMPLATES.filter((t) => t.tier === "t4")) {
      expect(t.requiredStreetCred).toBe(30);
    }
    for (const t of GIG_TEMPLATES.filter((t) => t.tier === "t5")) {
      expect(t.requiredStreetCred).toBe(50);
    }
  });

  it("should keep difficulty within the DB CHECK range (1-100)", () => {
    for (const t of GIG_TEMPLATES) {
      expect(t.difficulty).toBeGreaterThanOrEqual(1);
      expect(t.difficulty).toBeLessThanOrEqual(100);
      expect(t.escapeDifficulty).toBeGreaterThanOrEqual(1);
      expect(t.escapeDifficulty).toBeLessThanOrEqual(100);
    }
  });

  it("should keep legwork duration within the DB CHECK range (5-30 minutes)", () => {
    for (const t of GIG_TEMPLATES) {
      expect(t.legworkMinutes).toBeGreaterThanOrEqual(5);
      expect(t.legworkMinutes).toBeLessThanOrEqual(30);
    }
  });

  it("should not generate negative heat on success", () => {
    for (const t of GIG_TEMPLATES) {
      expect(t.heatGenerated).toBeGreaterThanOrEqual(0);
    }
  });

  it("should have unique display names (gigs.name is UNIQUE)", () => {
    const names = GIG_TEMPLATES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("should have non-empty descriptions", () => {
    for (const t of GIG_TEMPLATES) {
      expect(t.description.trim().length).toBeGreaterThan(0);
    }
  });
});
