import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BottomNav, { DRAWER_CONTROL_ID } from "@/components/shell/BottomNav";

describe("BottomNav", () => {
  it("renders the 5 primary destinations with correct routes", () => {
    render(
      <MemoryRouter>
        <BottomNav drawerOpen={false} onOpenDrawer={vi.fn()} />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Trampos" })).toHaveAttribute("href", "/gigs");
    expect(screen.getByRole("link", { name: "Saideira" })).toHaveAttribute("href", "/saideira");
    expect(screen.getByRole("link", { name: "Cromo" })).toHaveAttribute("href", "/chrome");
    expect(screen.getByRole("link", { name: "PvP" })).toHaveAttribute("href", "/pvp");
  });

  it("exposes the drawer toggle with the dialog contract", () => {
    const onOpenDrawer = vi.fn();
    render(
      <MemoryRouter>
        <BottomNav drawerOpen={false} onOpenDrawer={onOpenDrawer} />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: "Mais" });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", DRAWER_CONTROL_ID);

    button.click();
    expect(onOpenDrawer).toHaveBeenCalledTimes(1);
  });

  it("reflects the open state in aria-expanded", () => {
    render(
      <MemoryRouter>
        <BottomNav drawerOpen onOpenDrawer={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Mais" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("marks the active destination with aria-current=page", () => {
    render(
      <MemoryRouter initialEntries={["/gigs"]}>
        <BottomNav drawerOpen={false} onOpenDrawer={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Trampos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Inactive destinations carry no aria-current.
    expect(screen.getByRole("link", { name: "Painel" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Saideira" })).not.toHaveAttribute("aria-current");
  });
});
