import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Panel from "./Panel";

describe("Panel", () => {
  it("should render title and children in default state", () => {
    render(
      <Panel title="Painel">
        <p>conteúdo</p>
      </Panel>,
    );
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("should render accessory next to the title", () => {
    render(<Panel title="Painel" accessory={<button>ação</button>} />);
    expect(screen.getByRole("button", { name: "ação" })).toBeInTheDocument();
  });

  it("should show skeleton and aria-busy while loading", () => {
    render(<Panel title="Painel" status="loading" />);
    const section = screen.getByRole("heading", { name: "Painel" }).closest("section");
    expect(section).toHaveAttribute("aria-busy", "true");
    // Skeleton lines are aria-hidden decorative divs with the pulse class.
    expect(section!.querySelectorAll(".animate-pulse-neon").length).toBe(3);
  });

  it("should show errorMessage and trigger onRetry", async () => {
    const onRetry = vi.fn();
    render(<Panel status="error" errorMessage="Falha." onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Falha.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should show default error message when errorMessage is omitted", () => {
    render(<Panel status="error" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Erro ao carregar.");
  });

  it("should show emptyMessage in empty state", () => {
    render(<Panel status="empty" emptyMessage="Vazio." />);
    expect(screen.getByText("Vazio.")).toBeInTheDocument();
  });

  it("should show default empty message when emptyMessage is omitted", () => {
    render(<Panel status="empty" />);
    expect(screen.getByText("Nada por aqui.")).toBeInTheDocument();
  });

  it.each([
    ["default", "card", null],
    ["alert", "border-nd-gold/40 shadow-neon-gold", "⚠"],
    ["danger", "border-nd-magenta/40 shadow-neon-magenta", "!"],
    ["highlight", "border-nd-purple/40 shadow-neon-purple", "◆"],
  ] as const)("should apply %s variant frame and glyph", (variant, frame, glyph) => {
    render(<Panel title="Painel" variant={variant} />);
    const section = screen.getByRole("heading", { name: "Painel" }).closest("section");
    expect(section).toHaveClass(frame);
    if (glyph) {
      expect(screen.getByText(glyph)).toBeInTheDocument();
    }
  });
});
