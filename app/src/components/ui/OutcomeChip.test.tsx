import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OutcomeChip from "./OutcomeChip";

describe("OutcomeChip", () => {
  it("should render success glyph, color and label", () => {
    render(<OutcomeChip label="Sucesso" outcome="success" />);
    expect(screen.getByText(/Sucesso BEM-SUCEDIDA/)).toHaveClass("text-nd-green");
    expect(screen.getByText(/✓/)).toBeInTheDocument();
  });

  it("should render failure glyph, color and label", () => {
    render(<OutcomeChip label="Falha" outcome="failure" />);
    expect(screen.getByText(/Falha FALHOU/)).toHaveClass("text-nd-magenta");
    expect(screen.getByText(/✗/)).toBeInTheDocument();
  });

  it("should render critical with CRÍTICO label regardless of caller label", () => {
    render(<OutcomeChip label="Qualquer" outcome="critical" />);
    expect(screen.getByText(/CRÍTICO/)).toHaveClass("text-nd-gold");
    expect(screen.getByText(/!/)).toBeInTheDocument();
    expect(screen.queryByText(/Qualquer/)).not.toBeInTheDocument();
  });

  it("should render nothing when outcome is null", () => {
    const { container } = render(<OutcomeChip label="Pendente" outcome={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should show roll and chance detail when both provided (decimal, rendered as percent)", () => {
    render(<OutcomeChip label="Sucesso" outcome="success" roll={0.12} chance={0.5} />);
    expect(screen.getByText(/rolou 0\.12 vs 50%/)).toBeInTheDocument();
  });

  it("should not show roll detail when chance is missing", () => {
    render(<OutcomeChip label="Sucesso" outcome="success" roll={0.12} />);
    expect(screen.queryByText(/rolou/)).not.toBeInTheDocument();
  });

  it("should not show roll detail when roll is the negative no-roll sentinel", () => {
    render(<OutcomeChip label="Sucesso" outcome="success" roll={-1} chance={0} />);
    expect(screen.queryByText(/rolou/)).not.toBeInTheDocument();
  });
});
