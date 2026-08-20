import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCountdownTo } from "@/lib/useCountdownTo";

describe("useCountdownTo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns seconds remaining and ticks down every second", () => {
    const endsAt = Date.now() + 65_000;
    const { result } = renderHook(() => useCountdownTo(endsAt));

    expect(result.current).toBe(65);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current).toBe(62);
  });

  it("floors at 0 once the deadline passes", () => {
    const endsAt = Date.now() + 1_500;
    const { result } = renderHook(() => useCountdownTo(endsAt));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBe(0);
  });

  it("returns 0 for null and for past deadlines", () => {
    const { result: nullResult } = renderHook(() => useCountdownTo(null));
    expect(nullResult.current).toBe(0);

    const { result: pastResult } = renderHook(() => useCountdownTo(Date.now() - 10_000));
    expect(pastResult.current).toBe(0);
  });
});
