import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("should render the message with the default glyph aria-hidden", () => {
    render(<EmptyState message="Nada por aqui." />);
    expect(screen.getByText("Nada por aqui.")).toBeInTheDocument();
    const glyph = screen.getByText("∅");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
  });

  it("should render a custom glyph and action node", () => {
    render(
      <EmptyState
        message="Sem eventos."
        glyph="✕"
        action={<button type="button">Recarregar</button>}
      />,
    );
    expect(screen.getByText("✕")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeInTheDocument();
  });
});
