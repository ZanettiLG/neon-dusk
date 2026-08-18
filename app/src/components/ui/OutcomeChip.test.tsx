import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OutcomeChip from "./OutcomeChip";

describe("OutcomeChip", () => {
  it("should render success glyph, color and label", () => {
    render(<OutcomeChip label="Sucesso" outcome="success" />);
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("Sucesso")).toHaveClass("text-nd-green");
  });

  it("should render failure glyph, color and label", () => {
    render(<OutcomeChip label="Falha" outcome="failure" />);
    expect(screen.getByText("✗")).toBeInTheDocument();
    expect(screen.getByText("Falha")).toHaveClass("text-nd-magenta");
  });

  it("should render critical with CRÍTICO label regardless of caller label", () => {
    render(<OutcomeChip label="Qualquer" outcome="critical" />);
    expect(screen.getByText("!")).toBeInTheDocument();
    expect(screen.getByText("CRÍTICO")).toHaveClass("text-nd-gold");
    expect(screen.queryByText("Qualquer")).not.toBeInTheDocument();
  });

  it("should render nothing when outcome is null", () => {
    const { container } = render(<OutcomeChip label="Pendente" outcome={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should show roll and chance detail when both provided", () => {
    render(<OutcomeChip label="Sucesso" outcome="success" roll={12} chance={50} />);
    expect(screen.getByText(/rolou 12 vs 50%/)).toBeInTheDocument();
  });

  it("should not show roll detail when chance is missing", () => {
    render(<OutcomeChip label="Sucesso" outcome="success" roll={12} />);
    expect(screen.queryByText(/rolou/)).not.toBeInTheDocument();
  });
});
