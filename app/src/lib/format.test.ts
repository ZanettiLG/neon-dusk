import { describe, it, expect } from "vitest";
import {
  formatCooldown,
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

  it("omits the hour unit when hours are zero", () => {
    expect(formatDuration(86_400)).toBe("1d");
    expect(formatDuration(2 * 86_400)).toBe("2d");
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

describe("formatCooldown (#187 trampo tiers)", () => {
  it("renders seconds below 1min", () => {
    expect(formatCooldown(5)).toBe("5s");
    expect(formatCooldown(59)).toBe("59s");
  });

  it("renders minutes below 1h", () => {
    expect(formatCooldown(60)).toBe("1min");
    expect(formatCooldown(900)).toBe("15min");
  });

  it("renders hours up to 24h, then days", () => {
    expect(formatCooldown(7200)).toBe("2h");
    expect(formatCooldown(86_400)).toBe("24h");
    expect(formatCooldown(172_800)).toBe("2d");
  });

  it("clamps negative input to zero", () => {
    expect(formatCooldown(-5)).toBe("0s");
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
