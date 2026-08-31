import { describe, it, expect, beforeEach } from "vitest";
import {
  STREET_CRED_THRESHOLDS,
  LAST_SEEN_TITLE_KEY,
  titleIndex,
  thresholdForTitle,
  detectRankUp,
} from "@/lib/street-cred";
import type { StreetCredInfo } from "@neon-dusk/shared";

/** Pinning test — locks the ladder mirror to the server contract
 *  (server/src/game/street-cred.ts). Fails loudly if either side drifts. */
describe("street-cred ladder mirror", () => {
  it("pins the 7 ladder rungs (score + title) exactly as the server defines", () => {
    expect(STREET_CRED_THRESHOLDS).toEqual([
      { score: 0, title: "Zé Ninguém" },
      { score: 10, title: "Perna" },
      { score: 25, title: "Pro" },
      { score: 50, title: "Corredor" },
      { score: 75, title: "Elite" },
      { score: 90, title: "Lenda de SP" },
      { score: 100, title: "Lenda" },
    ]);
  });

  it("titleIndex returns the ladder index or -1 for unknown titles", () => {
    expect(titleIndex("Zé Ninguém")).toBe(0);
    expect(titleIndex("Lenda")).toBe(6);
    expect(titleIndex("Rei do Mundo")).toBe(-1);
  });

  it("thresholdForTitle returns the score or null for unknown titles", () => {
    expect(thresholdForTitle("Pro")).toBe(25);
    expect(thresholdForTitle("Lenda")).toBe(100);
    expect(thresholdForTitle("Coringa")).toBeNull();
  });
});

describe("detectRankUp", () => {
  const info = (score: number, title: string): StreetCredInfo => ({
    score,
    title,
    maxAchieved: score,
    nextThreshold: null,
    scToNext: null,
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null on first visit but records the current title", () => {
    expect(detectRankUp(info(10, "Perna"))).toBeNull();
    expect(window.localStorage.getItem(LAST_SEEN_TITLE_KEY)).toBe("Perna");
  });

  it("returns null when the title did not change (and rewrites the same title)", () => {
    detectRankUp(info(10, "Perna"));
    expect(detectRankUp(info(15, "Perna"))).toBeNull();
    expect(window.localStorage.getItem(LAST_SEEN_TITLE_KEY)).toBe("Perna");
  });

  it("returns null on decay (title went down) but records the lower title", () => {
    detectRankUp(info(25, "Pro"));
    expect(detectRankUp(info(12, "Perna"))).toBeNull();
    expect(window.localStorage.getItem(LAST_SEEN_TITLE_KEY)).toBe("Perna");
  });

  it("emits one event when crossing a single rung", () => {
    detectRankUp(info(0, "Zé Ninguém"));
    expect(detectRankUp(info(30, "Pro"))).toEqual({
      title: "Pro",
      score: 30,
      threshold: 25,
    });
  });

  it("emits exactly one event for the final title when many rungs are crossed at once", () => {
    detectRankUp(info(10, "Perna"));
    expect(detectRankUp(info(95, "Lenda de SP"))).toEqual({
      title: "Lenda de SP",
      score: 95,
      threshold: 90,
    });
  });

  it("returns null when the stored previous title is not on the ladder", () => {
    window.localStorage.setItem(LAST_SEEN_TITLE_KEY, "Fantasma da Zona Sul");
    expect(detectRankUp(info(50, "Corredor"))).toBeNull();
  });
});
