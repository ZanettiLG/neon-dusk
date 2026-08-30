import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { create } from "zustand";
import { MemoryRouter } from "react-router-dom";
import PlayersTab from "@/views/admin/PlayersTab";
import type { AdminPlayer } from "@neon-dusk/shared";

// Mock the admin store as a controllable Zustand singleton (same pattern as
// SaideiraView.test.tsx): components subscribe to state we set per test, and
// the fetch actions are no-ops so there are no async races between the mount
// effect and render assertions.
const storeMocks = vi.hoisted(() => {
  const initial = {
    players: [] as AdminPlayer[],
    playersTotal: 0,
    playersPage: 1,
    playersLoading: false,
    playersError: null as string | null,
    fetchPlayers: vi.fn(),
    banPlayer: vi.fn(),
    unbanPlayer: vi.fn(),
  };
  return { initial };
});

vi.mock("@/stores/admin", () => ({
  useAdminStore: create(() => ({ ...storeMocks.initial })),
}));

const { useAdminStore } = await import("@/stores/admin");

function player(overrides: Partial<AdminPlayer>): AdminPlayer {
  return {
    id: "char-1",
    name: "Ghost",
    level: 3,
    sc: 25,
    eddies: 1200,
    crew: null,
    lastLogin: "2085-01-01T00:00:00.000Z",
    status: "active",
    ...overrides,
  };
}

function renderView() {
  return render(
    <MemoryRouter>
      <PlayersTab />
    </MemoryRouter>,
  );
}

describe("PlayersTab", () => {
  beforeEach(() => {
    useAdminStore.setState({ ...storeMocks.initial });
    vi.clearAllMocks();
  });

  it("should render the player table with names and status badges", () => {
    useAdminStore.setState({
      players: [
        player({ id: "char-1", name: "Ghost", status: "active" }),
        player({ id: "char-2", name: "Raven", status: "banned", eddies: 0 }),
      ],
      playersTotal: 2,
    });

    renderView();

    expect(screen.getByText("Ghost")).toBeInTheDocument();
    expect(screen.getByText("Raven")).toBeInTheDocument();
    expect(screen.getByText("ativo")).toBeInTheDocument();
    expect(screen.getByText("banido")).toBeInTheDocument();
    expect(screen.getByText("2 jogadores — página 1 de 1")).toBeInTheDocument();
  });

  it("should ban a player after confirmation with a reason", async () => {
    const user = userEvent.setup();
    const banPlayer = vi.fn().mockResolvedValue(undefined);
    useAdminStore.setState({
      players: [player({ id: "char-1", name: "Ghost" })],
      playersTotal: 1,
      banPlayer,
    });

    renderView();

    await user.click(screen.getByRole("button", { name: "ban" }));
    expect(screen.getByText("Banir jogador")).toBeInTheDocument();

    // Confirm is disabled until a reason is typed.
    const confirm = screen.getByRole("button", { name: "Banir" });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Motivo do ban..."), "Griefing");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(banPlayer).toHaveBeenCalledWith("char-1", "Griefing");
    // Modal closes after the action resolves.
    expect(screen.queryByText("Banir jogador")).not.toBeInTheDocument();
  });

  it("should unban a player after confirmation", async () => {
    const user = userEvent.setup();
    const unbanPlayer = vi.fn().mockResolvedValue(undefined);
    useAdminStore.setState({
      players: [player({ id: "char-1", name: "Ghost", status: "banned" })],
      playersTotal: 1,
      unbanPlayer,
    });

    renderView();

    await user.click(screen.getByRole("button", { name: "unban" }));
    expect(screen.getByText("Remover ban")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(unbanPlayer).toHaveBeenCalledWith("char-1");
    expect(screen.queryByText("Remover ban")).not.toBeInTheDocument();
  });

  it("should show the store error when players fail to load", () => {
    useAdminStore.setState({ playersError: "Falha ao carregar jogadores" });

    renderView();

    expect(screen.getByText("Falha ao carregar jogadores")).toBeInTheDocument();
  });
});
