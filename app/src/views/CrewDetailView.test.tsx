import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { create } from "zustand";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CrewDetailView from "@/views/CrewDetailView";
import type { Character, CrewDetailResponse } from "@neon-dusk/shared";

// Mock the crew store as a controllable Zustand singleton — no real SSE, and
// every action is a no-op we can assert on.
const storeMocks = vi.hoisted(() => ({
  initial: {
    crewDetail: null as CrewDetailResponse | null,
    detailLoading: false,
    detailError: null as string | null,
    messages: [],
    chatStatus: "offline" as const,
    chatSendLoading: false,
    chatSendError: null as string | null,
    fetchCrewDetail: vi.fn(),
    inviteMember: vi.fn(),
    joinCrew: vi.fn(),
    leaveCrew: vi.fn(),
    kickMember: vi.fn(),
    dissolveCrew: vi.fn(),
    sendMessage: vi.fn(),
    connectChat: vi.fn(),
    disconnectChat: vi.fn(),
    fetchChatHistory: vi.fn(),
  },
}));

vi.mock("@/stores/crew", () => ({
  useCrewStore: create(() => ({ ...storeMocks.initial })),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: create(() => ({ character: null as Character | null })),
}));

const { useCrewStore } = await import("@/stores/crew");
const { useAuthStore } = await import("@/stores/auth");

function character(id: string, streetCred = 50): Character {
  return {
    id,
    userId: "u1",
    name: "Ghost",
    origin: "a_paraiso",
    role: "solo",
    body: 3,
    reflexes: 3,
    intelligence: 3,
    technical: 3,
    cool: 3,
    streetCred,
    maxStreetCredAchieved: streetCred,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const crewDetail: CrewDetailResponse = {
  crew: {
    id: "c1",
    name: "As Gralhas",
    tag: "GRL",
    leaderId: "char-1",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  members: [
    {
      id: "m1",
      characterId: "char-1",
      characterName: "Ghost",
      streetCred: 50,
      joinedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "m2",
      characterId: "char-2",
      characterName: "Raven",
      streetCred: 10,
      joinedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  bonuses: [{ type: "gig_success", description: "Chance de sucesso em gigs", value: 5 }],
  leaderboardPosition: 1,
};

function renderView() {
  return render(
    <MemoryRouter initialEntries={["/crews/c1"]}>
      <Routes>
        <Route path="/crews/:id" element={<CrewDetailView />} />
        <Route path="/crews" element={<div>CREWS PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CrewDetailView", () => {
  beforeEach(() => {
    useCrewStore.setState({ ...storeMocks.initial });
    useAuthStore.setState({ character: null });
    vi.clearAllMocks();
  });

  it("should show a loading state while the crew detail is being fetched", () => {
    useCrewStore.setState({ detailLoading: true });

    renderView();

    expect(screen.getByText("▌ loading...")).toBeInTheDocument();
  });

  it("should render the crew header, bonuses, members and chat for the leader", () => {
    useCrewStore.setState({ crewDetail });
    useAuthStore.setState({ character: character("char-1") });

    renderView();

    expect(screen.getByText("As Gralhas")).toBeInTheDocument();
    expect(screen.getByText("[GRL]")).toBeInTheDocument();
    expect(screen.getByText("Chance de sucesso em gigs: +5")).toBeInTheDocument();
    expect(screen.getByText("Raven")).toBeInTheDocument();
    expect(screen.getByText("[LÍDER]")).toBeInTheDocument();

    // Leader-only actions.
    expect(screen.getByRole("button", { name: "Dissolver Crew" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expulsar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Convidar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sair da Crew" })).not.toBeInTheDocument();
    // Member → chat panel is visible.
    expect(screen.getByText("Chat da Crew")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Mensagem...")).toBeInTheDocument();
  });

  it("should show join/send actions for a non-member visitor and hide the chat", () => {
    useCrewStore.setState({ crewDetail });
    useAuthStore.setState({ character: character("char-9", 5) });

    renderView();

    expect(screen.getByRole("button", { name: "Entrar na Crew" })).toBeInTheDocument();
    expect(screen.queryByText("Chat da Crew")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expulsar" })).not.toBeInTheDocument();
  });

  it("should show member actions for a non-leader member", () => {
    useCrewStore.setState({ crewDetail });
    useAuthStore.setState({ character: character("char-2", 10) });

    renderView();

    expect(screen.getByRole("button", { name: "Sair da Crew" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dissolver Crew" })).not.toBeInTheDocument();
    expect(screen.getByText("Chat da Crew")).toBeInTheDocument();
  });

  it("should show an error state when the fetch fails", () => {
    useCrewStore.setState({ detailError: "Crew não encontrada." });

    renderView();

    expect(screen.getByText("Crew não encontrada.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Voltar" })).toHaveAttribute("href", "/crews");
  });
});
