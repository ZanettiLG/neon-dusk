import { describe, it, expect } from "vitest";
import {
  formatCountdown,
  formatDuration,
  formatEds,
  formatRelativeTime,
} from "@/lib/format";

describe("formatEds", () => {
  it("formats with pt-BR grouping", () => {
    expect(formatEds(0)).toBe("G$ 0");
    expect(formatEds(1234)).toBe("G$ 1.234");
    expect(formatEds(1234567)).toBe("G$ 1.234.567");
    expect(formatEds(-500)).toBe("G$ -500");
  });
});

describe("formatDuration", () => {
  it("renders days + hours", () => {
    expect(formatDuration(90_000)).toBe("1d 1h");
    expect(formatDuration(2 * 86_400 + 5 * 3600)).toBe("2d 5h");
  });

  it("renders hours only below a day", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(0)).toBe("0h");
  });

  it("clamps negative input to zero", () => {
    expect(formatDuration(-10)).toBe("0h");
  });
});

describe("formatCountdown", () => {
  it("renders m:ss", () => {
    expect(formatCountdown(95)).toBe("1:35");
    expect(formatCountdown(9)).toBe("0:09");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-01-01T12:00:00Z").getTime();

  it("renders PT relative buckets", () => {
    expect(formatRelativeTime(new Date(now - 30_000).toISOString(), now)).toBe("agora");
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe("há 5 min");
    expect(formatRelativeTime(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("há 3 h");
    expect(formatRelativeTime(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe("há 2 d");
  });
});
