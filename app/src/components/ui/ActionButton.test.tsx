import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionButton from "./ActionButton";

describe("ActionButton", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render children and be clickable by default", async () => {
    const onClick = vi.fn();
    render(<ActionButton onClick={onClick}>Executar</ActionButton>);
    const btn = screen.getByRole("button", { name: "Executar" });
    expect(btn).toBeEnabled();
    await userEvent.setup().click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should disable and show spinner while loading", () => {
    render(<ActionButton status="loading">Executar</ActionButton>);
    const btn = screen.getByRole("button", { name: "Executar" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("should disable and show countdown while on cooldown", () => {
    render(<ActionButton status="cooldown" cooldownRemainingS={95} cooldownLabel="recarga">
      Executar
    </ActionButton>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("recarga 1:35");
  });

  it("should decrement countdown every second and re-enable at zero", () => {
    vi.useFakeTimers();
    render(<ActionButton status="cooldown" cooldownRemainingS={2}>Executar</ActionButton>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("cooldown 0:02");
    act(() => vi.advanceTimersByTime(1000));
    expect(btn).toHaveTextContent("cooldown 0:01");
    act(() => vi.advanceTimersByTime(1000));
    // remaining hits 0 → isCooldown false → children shown, button enabled
    expect(btn).toHaveTextContent("Executar");
    expect(btn).toBeEnabled();
  });

  it("should clear the countdown interval once it reaches zero", () => {
    vi.useFakeTimers();
    render(<ActionButton status="cooldown" cooldownRemainingS={2}>Executar</ActionButton>);
    act(() => vi.advanceTimersByTime(2000));
    // Interval was cleared inside the tick that hit 0 → no timers left.
    expect(vi.getTimerCount()).toBe(0);
    // Advancing further must not trigger any state update.
    act(() => vi.advanceTimersByTime(5000));
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("Executar");
    expect(btn).toBeEnabled();
  });

  it("should resync countdown when cooldownRemainingS prop changes", () => {
    vi.useFakeTimers();
    const { rerender } = render(<ActionButton status="cooldown" cooldownRemainingS={5}>Executar</ActionButton>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("cooldown 0:05");
    rerender(<ActionButton status="cooldown" cooldownRemainingS={10}>Executar</ActionButton>);
    expect(btn).toHaveTextContent("cooldown 0:10");
  });

  it("should disable and show blockReason in the DOM when blocked", () => {
    render(<ActionButton status="blocked" blockReason="Sem NIL suficiente">Executar</ActionButton>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("⛔ Sem NIL suficiente")).toBeInTheDocument();
    // aria-describedby points to the reason element
    const describedBy = btn.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("Sem NIL suficiente");
  });

  it("should stay enabled and show errorMessage with role=alert when error", () => {
    render(<ActionButton status="error" errorMessage="Falha na ação">Executar</ActionButton>);
    const btn = screen.getByRole("button", { name: "Executar" });
    expect(btn).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Falha na ação");
  });

  it("should apply variant classes", () => {
    const { rerender } = render(<ActionButton variant="danger">Executar</ActionButton>);
    expect(screen.getByRole("button")).toHaveClass("btn-danger");
    rerender(<ActionButton variant="gold">Executar</ActionButton>);
    expect(screen.getByRole("button")).toHaveClass("btn-neon");
    expect(screen.getByRole("button")).toHaveClass("border-nd-gold");
  });

  it("should respect explicit disabled prop", () => {
    render(<ActionButton disabled>Executar</ActionButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
