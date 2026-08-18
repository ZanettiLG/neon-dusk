import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PhaseStepper from "./PhaseStepper";
import type { PhaseStep } from "./types";

const phases: PhaseStep[] = [
  { id: "p1", label: "Preparação" },
  { id: "p2", label: "Execução" },
  { id: "p3", label: "Extração" },
];

describe("PhaseStepper", () => {
  it("should mark phases before currentIndex as done with checkmark", () => {
    render(<PhaseStepper phases={phases} currentIndex={1} />);
    // p1 done → ✓, p2 current → 2, p3 pending → 3
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should set aria-current=step on the current phase", () => {
    render(<PhaseStepper phases={phases} currentIndex={1} />);
    const current = screen.getByText("Execução").closest("li");
    expect(current).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Preparação").closest("li")).not.toHaveAttribute("aria-current");
  });

  it("should render errorIndex phase with magenta ! glyph", () => {
    render(<PhaseStepper phases={phases} currentIndex={2} errorIndex={1} />);
    const errorDot = screen.getByText("!").closest("span");
    expect(errorDot).toHaveClass("border-nd-magenta");
    expect(screen.getByText("!")).toBeInTheDocument();
  });

  it("should render all phases pending when currentIndex is 0", () => {
    render(<PhaseStepper phases={phases} currentIndex={0} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("✓")).not.toBeInTheDocument();
  });
});
