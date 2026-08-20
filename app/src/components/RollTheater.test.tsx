import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import RollTheater from "@/components/RollTheater";
import type { RollTheaterOutcome } from "@/components/RollTheater";

const originalMatchMedia = window.matchMedia;

/** jsdom has no matchMedia — stub it to control prefers-reduced-motion. */
function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

/** Restore the real (absent) matchMedia so other suites are unaffected. */
function restoreMatchMedia() {
  window.matchMedia = originalMatchMedia as typeof window.matchMedia;
}

/** Advance the stage machine through every timed stage (real delays). */
function runSequence() {
  act(() => vi.advanceTimersByTime(1400)); // rolling → reveal
  act(() => vi.advanceTimersByTime(500)); // reveal → verdict
  act(() => vi.advanceTimersByTime(400)); // verdict → copy
  act(() => vi.advanceTimersByTime(400)); // copy → done
}

/** Advance to the verdict stage (rolling → reveal → verdict). */
function runToVerdict() {
  act(() => vi.advanceTimersByTime(1400)); // rolling → reveal
  act(() => vi.advanceTimersByTime(500)); // reveal → verdict
}

describe("RollTheater", () => {
  afterEach(() => {
    restoreMatchMedia();
    vi.useRealTimers();
  });

  it("should play the full sequence and call onComplete once on Continuar", () => {
    // Motion NOT reduced → real stage delays so each stage is observable.
    stubMatchMedia(false);
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const outcome: RollTheaterOutcome = { success: true, roll: 0.42, successChance: 0.65 };

    render(<RollTheater label="EXECUÇÃO" outcome={outcome} copy="Serviço limpo." onComplete={onComplete} />);

    // rolling stage
    expect(screen.getByText(/ROLLING/i)).toBeInTheDocument();

    // reveal stage shows the raw roll
    act(() => vi.advanceTimersByTime(1400));
    expect(screen.getByText("0.42")).toBeInTheDocument();

    // verdict stage: roll% vs chance% in monospace (font-data)
    act(() => vi.advanceTimersByTime(500));
    const verdict = screen.getByText(/ROLL 0\.42 \(42%\) vs CHANCE 65%/i);
    expect(verdict).toHaveClass("font-data");

    // copy stage
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByText("Serviço limpo.")).toBeInTheDocument();

    // done stage: Continuar button
    act(() => vi.advanceTimersByTime(400));
    const btn = screen.getByRole("button", { name: /continuar/i });
    fireEvent.click(btn);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("should render success verdict in green (nd-green)", () => {
    stubMatchMedia(false);
    vi.useFakeTimers();
    render(
      <RollTheater
        label="EXECUÇÃO"
        outcome={{ success: true, roll: 0.42, successChance: 0.65 }}
        copy="Serviço limpo."
        onComplete={vi.fn()}
      />,
    );
    runToVerdict();
    const verdict = screen.getByText(/✓ EXECUÇÃO SUCESSO/i);
    expect(verdict).toHaveClass("text-nd-green");
  });

  it("should render failure verdict in magenta (nd-magenta) — failure branch never omitted", () => {
    stubMatchMedia(false);
    vi.useFakeTimers();
    render(
      <RollTheater
        label="FUGA"
        outcome={{ success: false, roll: 0.8, successChance: 0.5 }}
        copy="A milícia te pegou."
        onComplete={vi.fn()}
      />,
    );
    runToVerdict();
    const verdict = screen.getByText(/✗ FUGA FALHA/i);
    expect(verdict).toHaveClass("text-nd-magenta");
    // Failure copy is shown in the copy stage that follows.
    act(() => vi.advanceTimersByTime(400)); // verdict → copy
    expect(screen.getByText("A milícia te pegou.")).toBeInTheDocument();
  });

  it("should skip numeric stages for the roll < 0 sentinel and show only ✓/✗ + copy + Continuar", () => {
    stubMatchMedia(false);
    vi.useFakeTimers();
    render(
      <RollTheater
        label="FUGA"
        outcome={{ success: true, roll: -1, successChance: 0 }}
        copy="A fuga saiu redonda."
        onComplete={vi.fn()}
      />,
    );
    // Sentinel starts at the copy stage — no rolling/reveal/verdict numeric stages.
    expect(screen.queryByText(/ROLLING/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ROLL/i)).not.toBeInTheDocument();
    expect(screen.getByText(/✓ FUGA SUCESSO/i)).toBeInTheDocument();
    expect(screen.getByText("A fuga saiu redonda.")).toBeInTheDocument();
    // Only the copy → done timer is scheduled (no rolling/reveal/verdict timers).
    expect(vi.getTimerCount()).toBe(1);
    // Advance copy → done so Continuar appears (user-dismissed, never auto).
    act(() => vi.advanceTimersByTime(400));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
  });

  it("should call onComplete exactly once per click on Continuar", () => {
    stubMatchMedia(false);
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(
      <RollTheater
        label="EXECUÇÃO"
        outcome={{ success: true, roll: 0.42, successChance: 0.65 }}
        copy="Serviço limpo."
        onComplete={onComplete}
      />,
    );
    runSequence();
    const btn = screen.getByRole("button", { name: /continuar/i });
    fireEvent.click(btn);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("should reach identical final content under prefers-reduced-motion with collapsed delays", () => {
    stubMatchMedia(true);
    vi.useFakeTimers();
    render(
      <RollTheater
        label="EXECUÇÃO"
        outcome={{ success: true, roll: 0.42, successChance: 0.65 }}
        copy="Serviço limpo."
        onComplete={vi.fn()}
      />,
    );
    // Reduced motion collapses every delay to 0ms — each advance fires the next
    // stage's timer (scheduled at +0), so a few advances cascade to done.
    act(() => vi.advanceTimersByTime(0)); // rolling → reveal
    act(() => vi.advanceTimersByTime(0)); // reveal → verdict
    expect(screen.getByText(/ROLL 0\.42 \(42%\) vs CHANCE 65%/i)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(0)); // verdict → copy
    act(() => vi.advanceTimersByTime(0)); // copy → done
    expect(screen.getByText("Serviço limpo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar/i })).toBeInTheDocument();
  });

  it("should not warn about act() when unmounting mid-sequence", () => {
    stubMatchMedia(false);
    vi.useFakeTimers();
    const { unmount } = render(
      <RollTheater
        label="EXECUÇÃO"
        outcome={{ success: true, roll: 0.42, successChance: 0.65 }}
        copy="Serviço limpo."
        onComplete={vi.fn()}
      />,
    );
    // Unmount while a stage timer is still pending — cleanup must clear it.
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // No state update after unmount → no act() warning, no crash.
    expect(vi.getTimerCount()).toBe(0);
  });
});
