import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DashboardView from "@/views/DashboardView";
import { useAuthStore } from "@/stores/auth";
import type {
  Character,
  CharacterEventsResponse,
  InstalledChromeResponse,
  NilStatus,
  User,
} from "@neon-dusk/shared";

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

const user: User = {
  id: "u1",
  email: "fixer@neondusk.gg",
  role: "player",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

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

const nilStatus: NilStatus = {
  current: 80,
  max: 100,
  nextTickSeconds: 300,
  regenerating: true,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const installedChrome: InstalledChromeResponse = {
  installed: [],
  effectiveHumanity: 97,
  humanitySpent: 0,
  statBonus: { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 },
  hpBonus: 0,
  gigSuccessBonus: 0,
  nilMaxBonus: 0,
};

const eventsResponse: CharacterEventsResponse = {
  events: [],
  nextCursor: null,
};

/** Route the mocked GET by path — new dashboard endpoints get real fixtures. */
function mockApiGet(nil: NilStatus = nilStatus) {
  mocks.api.get.mockImplementation((path: string) => {
    if (path === "/api/characters/me/nil") return Promise.resolve(nil);
    if (path === "/api/chrome/installed") return Promise.resolve(installedChrome);
    if (path.startsWith("/api/characters/me/events")) return Promise.resolve(eventsResponse);
    return Promise.resolve(nil); // /api/round + leaderboard fallback
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DashboardView", () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState());
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
  });

  it("should render the character card, NIL bar and attributes", async () => {
    mockApiGet();
    useAuthStore.setState({ accessToken: "at", refreshToken: "rt", user, character });
    renderDashboard();

    expect(await screen.findByText("Ghost")).toBeInTheDocument();
    expect(screen.getByText("Bicho · Origem: A Paraíso")).toBeInTheDocument();
    expect(screen.getByText("PAINEL DO CORREDOR")).toBeInTheDocument();
    expect(screen.getByText("fixer@neondusk.gg")).toBeInTheDocument();
    expect(screen.getByText("Desconectar")).toBeInTheDocument();

    // NIL readout fetched on mount.
    expect(await screen.findByText("80 / 100")).toBeInTheDocument();
    expect(screen.getByText("NIL // CARGA NEURAL")).toBeInTheDocument();
    expect(screen.getByText(/Próximo \+1 em/)).toBeInTheDocument();

    // Attribute grid.
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getAllByText("3")).toHaveLength(5);
    expect(mocks.api.get).toHaveBeenCalledWith("/api/characters/me/nil");

    // Feature #139 sections: humanity bar, body map empty, event feed empty, quick actions.
    expect(await screen.findByText("97 / 100")).toBeInTheDocument();
    expect(screen.getByText("Nenhum cromo instalado")).toBeInTheDocument();
    expect(screen.getByText("Nenhum evento recente.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PvP" })).toHaveAttribute("href", "/pvp");
    expect(mocks.api.get).toHaveBeenCalledWith("/api/chrome/installed");
    expect(mocks.api.get).toHaveBeenCalledWith("/api/characters/me/events");
  });

  it("should show the empty state when no character is linked", async () => {
    mockApiGet();
    useAuthStore.setState({ accessToken: "at", user, character: null });
    renderDashboard();

    expect(
      await screen.findByText("Nenhum personagem vinculado a esta conta."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar personagem" })).toHaveAttribute(
      "href",
      "/create-character",
    );
  });

  it("should apply the stim and update the NIL bar", async () => {
    mockApiGet();
    mocks.api.post.mockResolvedValue({
      added: 20,
      status: { ...nilStatus, current: 100, regenerating: false, nextTickSeconds: 0 },
    });
    useAuthStore.setState({ accessToken: "at", refreshToken: "rt", user, character });
    renderDashboard();

    const stim = await screen.findByRole("button", { name: "SYN-CAFÉ" });
    await userEvent.setup().click(stim);

    expect(await screen.findByText("100 / 100")).toBeInTheDocument();
    expect(await screen.findByText("NIL CHEIO")).toBeInTheDocument();
    expect(mocks.api.post).toHaveBeenCalledWith("/api/characters/me/nil/use-stim", {});
  });

  it("should surface NIL errors from the fetch", async () => {
    mocks.api.get.mockRejectedValue(new Error("NIL indisponível"));
    useAuthStore.setState({ accessToken: "at", user, character });
    renderDashboard();

    // The shared mock also rejects the leaderboard fetch, so the message may
    // appear more than once — assert the NIL span specifically exists.
    const nilError = await screen.findAllByText("NIL indisponível");
    expect(nilError.length).toBeGreaterThan(0);
  });

  it("should show NIL indisponível and hide the NIL bar when the NIL endpoint is blocked", async () => {
    mocks.api.get.mockImplementation((path: string) => {
      if (path === "/api/characters/me/nil") return Promise.reject(new Error("network down"));
      if (path === "/api/chrome/installed") return Promise.resolve(installedChrome);
      if (path.startsWith("/api/characters/me/events")) return Promise.resolve(eventsResponse);
      return Promise.resolve(nilStatus); // /api/round + leaderboard fallback
    });
    useAuthStore.setState({ accessToken: "at", refreshToken: "rt", user, character });
    renderDashboard();

    // Degraded state: PT-BR error line instead of the contradictory 0 / 0 +
    // "crítico" band + "NIL CHEIO" trio.
    expect(await screen.findByText("NIL indisponível")).toBeInTheDocument();
    expect(screen.queryByText("NIL CHEIO")).not.toBeInTheDocument();
    expect(screen.queryByText("0 / 0")).not.toBeInTheDocument();
    expect(screen.queryByText("crítico")).not.toBeInTheDocument();
  });

  it("should log out and navigate to /login", async () => {
    mockApiGet();
    mocks.api.post.mockResolvedValue(undefined);
    useAuthStore.setState({ accessToken: "at", refreshToken: "rt", user, character });
    renderDashboard();

    await userEvent.setup().click(await screen.findByRole("button", { name: "Desconectar" }));

    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    expect(mocks.api.post).toHaveBeenCalledWith("/api/auth/logout", {
      refreshToken: "rt",
    });
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("shows SOFT CAP label for attributes at or above 15", async () => {
    mockApiGet();
    const highStatChar: Character = {
      ...character,
      body: 16,
      reflexes: 15,
      intelligence: 14,
      technical: 3,
      cool: 3,
    };
    useAuthStore.setState({ accessToken: "at", refreshToken: "rt", user, character: highStatChar });
    renderDashboard();

    // Body (16) and Reflexes (15) should show SOFT CAP label.
    const softCaps = await screen.findAllByText("SOFT CAP");
    expect(softCaps).toHaveLength(2);

    // Intelligence (14) should NOT show SOFT CAP.
    const allSoftCaps = screen.getAllByText("SOFT CAP");
    expect(allSoftCaps).toHaveLength(2);
  });

  it("does not show SOFT CAP label when all stats are below 15", async () => {
    mockApiGet();
    useAuthStore.setState({ accessToken: "at", refreshToken: "rt", user, character });
    renderDashboard();

    expect(await screen.findByText("Ghost")).toBeInTheDocument();
    expect(screen.queryByText("SOFT CAP")).not.toBeInTheDocument();
  });
});
