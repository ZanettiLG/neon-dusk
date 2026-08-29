import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import TypewriterText, { prefersReducedMotion } from "@/components/chrome/TypewriterText";
import { stubMatchMedia, restoreMatchMedia } from "@/test-utils/matchMedia";

// Issue #10 — TypewriterText: digitação progressiva do log do Ferrageiro,
// instantânea sob prefers-reduced-motion, cleanup no unmount.

describe("TypewriterText", () => {
  afterEach(() => {
    restoreMatchMedia();
    vi.useRealTimers();
  });

  it("should type the text progressively at the given speed", () => {
    stubMatchMedia(false);
    vi.useFakeTimers();

    render(<TypewriterText text="abc" speedMs={24} />);

    expect(screen.queryByText("a")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(24));
    expect(screen.getByText("a")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(24));
    expect(screen.getByText("ab")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(24));
    expect(screen.getByText("abc")).toBeInTheDocument();

    // Interval self-clears at the end of the text.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("should render the full text immediately under prefers-reduced-motion", () => {
    stubMatchMedia(true);
    vi.useFakeTimers();

    render(<TypewriterText text="cromo na veia" speedMs={24} />);

    expect(screen.getByText("cromo na veia")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("should clear the interval on unmount mid-typing", () => {
    stubMatchMedia(false);
    vi.useFakeTimers();

    const { unmount } = render(<TypewriterText text="log longo do ferrageiro" speedMs={24} />);

    act(() => vi.advanceTimersByTime(48));
    unmount();

    act(() => vi.advanceTimersByTime(5000));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("should expose the prefersReducedMotion guard as jsdom-safe", () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});
