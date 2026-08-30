import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { create } from "zustand";
import { MemoryRouter } from "react-router-dom";
import SaideiraView from "@/views/SaideiraView";
import type {
  Character,
  ChatMessage,
  CrewLeaderboardResponse,
  LegendsResponse,
} from "@neon-dusk/shared";

// Mock the stores as controllable Zustand singletons (same pattern as
// Leaderboard.test.tsx): components subscribe to state we set per test, and
// the fetch actions are no-ops so there are no async races between the mount
// effect and render assertions.
const storeMocks = vi.hoisted(() => {
  const initial = {
    hub: null as {
      onlineCount: number;
      lastReset: string | null;
      currentRound: number;
      roundEndsAt: string;
    } | null,
    hubLoading: false,
    hubError: null as string | null,
    messages: [] as ChatMessage[],
    chatStatus: "offline" as const,
    chatSendLoading: false,
    chatSendError: null as string | null,
    legends: null as LegendsResponse | null,
    legendsLoading: false,
    legendsError: null as string | null,
    crewLeaderboard: null as CrewLeaderboardResponse | null,
    crewLoading: false,
    crewError: null as string | null,
    fetchHub: vi.fn(),
    fetchHistory: vi.fn(),
    sendMessage: vi.fn(),
    connectChat: vi.fn(),
    disconnectChat: vi.fn(),
    fetchLegends: vi.fn(),
    fetchCrewLeaderboard: vi.fn(),
  };
  return { initial };
});

vi.mock("@/stores/saideira", () => ({
  useSaideiraStore: create(() => ({ ...storeMocks.initial })),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: create(() => ({ character: null, accessToken: null })),
}));

vi.mock("@/stores/street-cred", () => ({
  useStreetCredStore: create(() => ({
    info: null,
    loading: false,
    error: null,
    leaderboard: null,
    leaderboardLoading: false,
    leaderboardError: null,
    fetchSC: vi.fn(),
    fetchLeaderboard: vi.fn(),
  })),
}));

const { useSaideiraStore } = await import("@/stores/saideira");
const { useAuthStore } = await import("@/stores/auth");

function character(streetCred: number): Character {
  return {
    id: "char-1",
    userId: "user-1",
    name: "Ghost",
    origin: "a_paraiso",
    role: "bicho",
    body: 5,
    reflexes: 4,
    intelligence: 4,
    technical: 4,
    cool: 5,
    streetCred,
    maxStreetCredAchieved: streetCred,
    ability: null,
    createdAt: "2085-01-01T00:00:00.000Z",
    updatedAt: "2085-01-01T00:00:00.000Z",
  };
}

function renderView() {
  return render(
    <MemoryRouter>
      <SaideiraView />
    </MemoryRouter>,
  );
}

describe("SaideiraView", () => {
  beforeEach(() => {
    useSaideiraStore.setState({ ...storeMocks.initial });
    useAuthStore.setState({ character: null, accessToken: null });
    vi.clearAllMocks();
  });

  it("should render the gate screen when Moral is below 10", () => {
    useAuthStore.setState({ character: character(5) });

    renderView();

    expect(screen.getByText("⚡ ACESSO RESTRITO")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /VER MINHA MORAL/ })).toBeInTheDocument();
    // The tabs must NOT be reachable while gated.
    expect(screen.queryByRole("tab", { name: /chat/i })).not.toBeInTheDocument();
    expect(
      screen.queryByText((content) => content.includes("O BAR QUE NUNCA FECHA")),
    ).not.toBeInTheDocument();
  });

  it("should show the correct gate message text explaining the SC 10 requirement", () => {
    useAuthStore.setState({ character: character(0) });

    renderView();

    expect(
      screen.getByText(/Você ainda não é conhecido o suficiente para entrar na Saideira\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Moral 10/)).toBeInTheDocument();
  });

  it("should render the hub tabs when Moral is 10 or above", () => {
    useAuthStore.setState({ character: character(10) });

    renderView();

    // Header text is split across elements ("SAIDEIRA" + <span>//</span> + rest).
    expect(
      screen.getByText((content) => content.includes("O BAR QUE NUNCA FECHA")),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ranking" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Lendas" })).toBeInTheDocument();
    // The tab container exposes the tablist role and the active tab is aria-selected.
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Ranking" })).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByText("⚡ ACESSO RESTRITO")).not.toBeInTheDocument();
  });

  it("should show hub online count and round in the header", () => {
    useAuthStore.setState({ character: character(25) });
    useSaideiraStore.setState({
      hub: {
        onlineCount: 12,
        lastReset: "2026-08-01T00:00:00.000Z",
        currentRound: 1,
        roundEndsAt: "2026-08-15T00:00:00.000Z",
      },
    });

    renderView();

    expect(screen.getByText("12 online")).toBeInTheDocument();
    // "Round" and the number are separate text nodes in the header.
    expect(screen.getByText((content) => content.includes("Round"))).toBeInTheDocument();
  });

  it("should show the legends menu when the Lendas tab is clicked", async () => {
    useAuthStore.setState({ character: character(15) });

    renderView();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Lendas" }));

    expect(screen.getByText("MENU DE LENDAS")).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma lenda ainda/)).toBeInTheDocument();
  });

  it("should render ChatBox with the message list", () => {
    useAuthStore.setState({ character: character(10) });
    useSaideiraStore.setState({
      messages: [
        {
          id: "m1",
          characterName: "Ghost",
          crewTag: null,
          message: "Primeira rodada!",
          createdAt: "2085-01-01T00:00:00.000Z",
        },
        {
          id: "m2",
          characterName: "Raven",
          crewTag: "Crows",
          message: "Vem cá, senta aqui.",
          createdAt: "2085-01-01T00:00:00.000Z",
        },
      ],
    });

    renderView();

    expect(screen.getByText("CIDADE // CHAT")).toBeInTheDocument();
    expect(screen.getByText("Ghost")).toBeInTheDocument();
    expect(screen.getByText("Primeira rodada!")).toBeInTheDocument();
    expect(screen.getByText("Raven")).toBeInTheDocument();
    expect(screen.getByText("Vem cá, senta aqui.")).toBeInTheDocument();
  });

  it("should render ChatBox input and send button", () => {
    useAuthStore.setState({ character: character(10) });

    renderView();

    expect(screen.getByPlaceholderText("Diz aí, corredor...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ENVIAR" })).toBeInTheDocument();
  });

  it("should render ChatBox without error when the stream is empty", () => {
    useAuthStore.setState({ character: character(10) });
    useSaideiraStore.setState({ messages: [], chatStatus: "connected" });

    renderView();

    expect(screen.getByText("CIDADE // CHAT")).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma mensagem ainda/)).toBeInTheDocument();
  });

  it("should render null when there is no authenticated character", () => {
    renderView();

    // The RequireCharacter route guard is the real gate; the view itself
    // renders nothing until a character is available.
    expect(screen.queryByText("⚡ ACESSO RESTRITO")).not.toBeInTheDocument();
    expect(screen.queryByText("SAIDEIRA // O BAR QUE NUNCA FECHA")).not.toBeInTheDocument();
  });
});
