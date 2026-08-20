import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Drawer from "@/components/shell/Drawer";
import { useAuthStore } from "@/stores/auth";
import type { User } from "@neon-dusk/shared";

const player: User = {
  id: "u1",
  email: "corredor@neondusk.gg",
  role: "player",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const admin: User = { ...player, id: "u9", email: "netwatch@neondusk.gg", role: "admin" };

describe("Drawer", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: player });
  });

  it("renders nothing when closed", () => {
    render(
      <MemoryRouter>
        <Drawer open={false} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the secondary destinations (Admin hidden for players)", () => {
    render(
      <MemoryRouter>
        <Drawer open onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const dialog = screen.getByRole("dialog", { name: "Menu secundário" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("link", { name: "Vendedores" })).toHaveAttribute("href", "/vendors");
    expect(screen.getByRole("link", { name: "Economia" })).toHaveAttribute("href", "/economy");
    expect(screen.getByRole("link", { name: "Bondes" })).toHaveAttribute("href", "/crews");
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("shows Admin for admin users", () => {
    useAuthStore.setState({ user: admin });

    render(
      <MemoryRouter>
        <Drawer open onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("focuses the first link on open and traps Tab at the edges", () => {
    render(
      <MemoryRouter>
        <Drawer open onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const firstLink = screen.getByRole("link", { name: "Vendedores" });
    const last = screen.getByRole("link", { name: "Bondes" });
    const close = screen.getByRole("button", { name: "Fechar menu" });
    expect(document.activeElement).toBe(firstLink);

    // The first focusable in DOM order is the close button: Shift+Tab from it
    // wraps to the last link (jsdom has no native tab order — focus it first).
    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    // Tab from the last link wraps back to the first focusable.
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
  });

  it("closes on Escape and returns focus to the opening toggle", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <button type="button">Toggle</button>
        <Drawer open={false} onClose={onClose} />
      </MemoryRouter>,
    );

    const toggle = screen.getByRole("button", { name: "Toggle" });
    toggle.focus();

    rerender(
      <MemoryRouter>
        <button type="button">Toggle</button>
        <Drawer open onClose={onClose} />
      </MemoryRouter>,
    );
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Vendedores" }));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(toggle);
  });

  it("closes on overlay click and restores focus", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <Drawer open onClose={onClose} />
      </MemoryRouter>,
    );

    // Overlay is the non-focusable dark layer right behind the panel.
    const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks body scroll while open", () => {
    const { unmount } = render(
      <MemoryRouter>
        <Drawer open onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
