import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import HomeView from "@/views/HomeView";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import type { Character, HealthResponse } from "@neon-dusk/shared";

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

const health: HealthResponse = {
  status: "ok",
  timestamp: "2026-01-01T00:00:00.000Z",
  uptime: 42,
  version: "0.1.0",
  services: { database: "connected", redis: "connected" },
};

describe("HomeView", () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState());
    mocks.api.get.mockReset();
  });

  it("should render the hero text and the system status card", async () => {
    mocks.api.get.mockResolvedValue(health);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HomeView />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "NEON // DUSK" })).toBeInTheDocument();
    expect(
      screen.getByText("Build your cromo. Burn your name. Leave a legend."),
    ).toBeInTheDocument();

    expect(screen.getByText("Status do Sistema")).toBeInTheDocument();
    expect(await screen.findByText("● ONLINE")).toBeInTheDocument();
    expect(screen.getAllByText("connected")).toHaveLength(2);
    expect(screen.getByText("42s")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    expect(mocks.api.get).toHaveBeenCalledWith("/api/health");
  });

  it("should show the error and retry when the health check fails", async () => {
    mocks.api.get.mockRejectedValueOnce(new Error("API down")).mockResolvedValue(health);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HomeView />
      </MemoryRouter>,
    );

    expect(await screen.findByText("API down")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("● ONLINE")).toBeInTheDocument();
  });
});

describe("HomeView CTAs (landing-nav)", () => {
  const character: Character = {
    id: "c1",
    userId: "u1",
    name: "Ghost",
    origin: "a_paraiso",
    role: "solo",
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
    mocks.api.get.mockResolvedValue(health);
  });

  const renderHome = () =>
    render(
      <MemoryRouter initialEntries={["/"]}>
        <HomeView />
      </MemoryRouter>,
    );

  it("should render 'Entrar no Jogo' link to /login when not authenticated", () => {
    useAuthStore.setState({ accessToken: null, character: null });

    renderHome();

    expect(screen.getByRole("link", { name: "Entrar no Jogo" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: "Criar Personagem" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Painel" })).not.toBeInTheDocument();
  });

  it("should render 'Criar Personagem' link to /create-character when authenticated without character", () => {
    useAuthStore.setState({ accessToken: "at", character: null });

    renderHome();

    expect(screen.getByRole("link", { name: "Criar Personagem" })).toHaveAttribute(
      "href",
      "/create-character",
    );
    expect(screen.queryByRole("link", { name: "Entrar no Jogo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Painel" })).not.toBeInTheDocument();
  });

  it("should render 'Painel' link to /dashboard when authenticated with character", () => {
    useAuthStore.setState({ accessToken: "at", character });

    renderHome();

    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Entrar no Jogo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Criar Personagem" })).not.toBeInTheDocument();
  });
});
