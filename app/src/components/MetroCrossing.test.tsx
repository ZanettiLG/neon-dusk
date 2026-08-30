import { describe, it, expect, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import MetroCrossing from "@/components/MetroCrossing";

// Half the ride — the boarding beat flips to the crossing beat at 900ms
// (mirrors CROSSING_PHASE_MS in the component).
const CROSSING_PHASE_MS = 900;

describe("MetroCrossing", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should announce the boarding beat on the destination line", () => {
    render(<MetroCrossing destination="o_fervo" />);

    expect(screen.getByText("▌ EMBARCANDO NA LINHA 4-LILÁS...")).toBeInTheDocument();
  });

  it("should announce the red line for a red-line destination", () => {
    render(<MetroCrossing destination="babilonia" />);

    expect(screen.getByText("▌ EMBARCANDO NA LINHA 3-VERMELHA...")).toBeInTheDocument();
  });

  it("should switch to the crossing beat after half the ride", () => {
    vi.useFakeTimers();
    render(<MetroCrossing destination="o_fervo" />);

    act(() => {
      vi.advanceTimersByTime(CROSSING_PHASE_MS);
    });

    expect(screen.getByText("▌ ATRAVESSANDO PARA O FERVO...")).toBeInTheDocument();
  });

  it("should expose the announcements to screen readers via role=status", () => {
    render(<MetroCrossing destination="o_fervo" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("should clear the phase timer on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = render(<MetroCrossing destination="o_fervo" />);

    unmount();

    // The pending phase timer must not fire after unmount — advancing it must
    // not throw or warn about a state update on an unmounted component.
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(CROSSING_PHASE_MS);
      });
    }).not.toThrow();
  });
});