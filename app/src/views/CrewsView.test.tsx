import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { create } from "zustand";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CrewsView from "@/views/CrewsView";
import type { Character, Crew } from "@neon-dusk/shared";

// Mock the crew store as a controllable Zustand singleton: fetchCrews is a
// no-op and the view renders whatever state we set per test.
const storeMocks = vi.hoisted(() => ({
  initial: {
    crews: [] as Crew[],
    crewsLoading: false,
    crewsError: null as string | null,
    fetchCrews: vi.fn(),
    createCrew: vi.fn(),
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

const crew: Crew = {
  id: "c1",
  name: "As Gralhas",
  tag: "GRL",
  leaderId: "char-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function character(streetCred: number): Character {
  return {
    id: "char-1",
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

function renderView() {
  return render(
    <MemoryRouter initialEntries={["/crews"]}>
      <Routes>
        <Route path="/crews" element={<CrewsView />} />
        <Route path="/crews/:id" element={<div>CREW DETAIL PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CrewsView", () => {
  beforeEach(() => {
    useCrewStore.setState({ ...storeMocks.initial });
    useAuthStore.setState({ character: null });
    vi.clearAllMocks();
  });

  it("should show a loading state while crews are being fetched", () => {
    useCrewStore.setState({ crewsLoading: true });

    renderView();

    expect(screen.getByText("▌ loading...")).toBeInTheDocument();
  });

  it("should render the crew directory", async () => {
    useCrewStore.setState({ crews: [crew] });

    renderView();

    expect(await screen.findByText("As Gralhas")).toBeInTheDocument();
    expect(screen.getByText("[GRL]")).toBeInTheDocument();
  });

  it("should show an error state when the fetch fails", () => {
    useCrewStore.setState({ crewsError: "Falha ao carregar crews" });

    renderView();

    expect(screen.getByText("Falha ao carregar crews")).toBeInTheDocument();
  });

  it("should gate crew creation behind SC 25", () => {
    useAuthStore.setState({ character: character(10) });

    renderView();

    expect(screen.getByText("SC 25 necessário para fundar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fundar Crew" })).not.toBeInTheDocument();
  });

  it("should allow crew creation at SC 25 and navigate to the new crew", async () => {
    useAuthStore.setState({ character: character(25) });
    storeMocks.initial.createCrew.mockResolvedValue(crew);
    const user = userEvent.setup();

    renderView();

    await user.click(screen.getByRole("button", { name: "Fundar Crew" }));
    // Labels are siblings of the inputs (no htmlFor) — address them by order.
    const [nameInput, tagInput] = screen.getAllByRole("textbox");
    await user.type(nameInput, "As Gralhas");
    await user.type(tagInput, "GRL");
    await user.click(screen.getByRole("button", { name: "Criar" }));

    expect(await screen.findByText("CREW DETAIL PAGE")).toBeInTheDocument();
    expect(storeMocks.initial.createCrew).toHaveBeenCalledWith("As Gralhas", "GRL");
  });
});
