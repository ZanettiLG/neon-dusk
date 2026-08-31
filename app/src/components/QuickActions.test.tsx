import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import QuickActions from "@/components/QuickActions";

// ND-139 / issue #56 — QuickActions: one-tap shortcuts to the main game loops.

describe("QuickActions", () => {
  it("should render the 5 shortcuts with their routes", () => {
    render(
      <MemoryRouter>
        <QuickActions />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Trampos" })).toHaveAttribute("href", "/gigs");
    expect(screen.getByRole("link", { name: "Saideira" })).toHaveAttribute("href", "/saideira");
    expect(screen.getByRole("link", { name: "Cromo" })).toHaveAttribute("href", "/chrome");
    expect(screen.getByRole("link", { name: "PvP" })).toHaveAttribute("href", "/pvp");
    expect(screen.getByRole("link", { name: "Vendedores" })).toHaveAttribute("href", "/vendors");
  });
});
