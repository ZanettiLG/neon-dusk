import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import type { Character } from "@neon-dusk/shared";

const mocks = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAccessToken: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  api: mocks.api,
  setAccessToken: mocks.setAccessToken,
  ApiError: class extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

describe("AppHeader", () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState());
    mocks.api.get.mockReset();
  });

  it("should render the brand and version badge", async () => {
    mocks.api.get.mockResolvedValue({
      status: "ok",
      timestamp: "2026-01-01T00:00:00.000Z",
      uptime: 1,
      version: "0.1.0",
      services: { database: "connected", redis: "connected" },
    });

    render(<AppHeader />);

    expect(screen.getByRole("heading", { name: "NEON // DUSK" })).toBeInTheDocument();
    expect(screen.getByText("v0.1.0-alpha")).toBeInTheDocument();

    // StatusBar inside the header polls health on mount.
    expect(await screen.findByText("● online")).toBeInTheDocument();
    expect(mocks.api.get).toHaveBeenCalledWith("/api/health");
  });
});

describe("AppHeader nav (landing-nav)", () => {
  const character: Character = {
    id: "c1",
    userId: "u1",
    name: "Ghost",
    origin: "a_paraiso",
    role: "bicho",
    body: 3,
    reflexes: 3,
    intelligence: 3,
    technical: 3,
    cool: 3,
  streetCred: 0,
  maxStreetCredAchieved: 0,
  ability: null,
  createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/street-cred") {
        return Promise.resolve({
          score: 0,
          title: "Nobody",
          maxAchieved: 0,
          nextThreshold: { score: 10, title: "Hustler" },
          scToNext: 10,
        });
      }
      return Promise.resolve({
        status: "ok",
        timestamp: "2026-01-01T00:00:00.000Z",
        uptime: 1,
        version: "0.1.0",
        services: { database: "connected", redis: "connected" },
      });
    });
  });

  it("should not render nav links when character is null", () => {
    useAuthStore.setState({ character: null });

    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("should render nav links with correct routes when character exists", () => {
    useAuthStore.setState({ character });

    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass("hidden sm:flex");
    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Trampos" })).toHaveAttribute("href", "/gigs");
    expect(screen.getByRole("link", { name: "Saideira" })).toHaveAttribute("href", "/saideira");
    expect(screen.getByRole("link", { name: "Cromo" })).toHaveAttribute("href", "/chrome");
    expect(screen.getByRole("link", { name: "Vendedores" })).toHaveAttribute("href", "/vendors");
    expect(screen.getByRole("link", { name: "PvP" })).toHaveAttribute("href", "/pvp");
    expect(screen.getByRole("link", { name: "Economia" })).toHaveAttribute("href", "/economy");
    expect(screen.getByRole("link", { name: "Bondes" })).toHaveAttribute("href", "/crews");
    // The Admin link is reserved for admin users — not shown for players.
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("should not render the Admin link for regular players", () => {
    useAuthStore.setState({
      character,
      user: {
        id: "u1",
        email: "fixer@neondusk.gg",
        role: "player",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Painel" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("should render the Admin link for admin users", () => {
    useAuthStore.setState({
      character,
      user: {
        id: "u9",
        email: "netwatch@neondusk.gg",
        role: "admin",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
    // Character links stay visible alongside the admin link.
    expect(screen.getByRole("link", { name: "Cromo" })).toHaveAttribute("href", "/chrome");
  });

  it("should render the Admin link for admins without a character (no character links)", () => {
    useAuthStore.setState({
      character: null,
      user: {
        id: "u9",
        email: "netwatch@neondusk.gg",
        role: "admin",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Trampos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Bondes" })).not.toBeInTheDocument();
  });
});
