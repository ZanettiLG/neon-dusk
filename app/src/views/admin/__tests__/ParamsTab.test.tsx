import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { create } from "zustand";
import { MemoryRouter } from "react-router-dom";
import ParamsTab from "@/views/admin/ParamsTab";

// Mock the admin store as a controllable Zustand singleton (same pattern as
// SaideiraView.test.tsx): components subscribe to state we set per test, and
// the fetch actions are no-ops so there are no async races between the mount
// effect and render assertions.
const storeMocks = vi.hoisted(() => {
  const initial = {
    params: {} as Record<string, string>,
    paramsLoading: false,
    paramsError: null as string | null,
    paramsSaving: false,
    fetchParams: vi.fn(),
    updateParams: vi.fn(),
  };
  return { initial };
});

vi.mock("@/stores/admin", () => ({
  useAdminStore: create(() => ({ ...storeMocks.initial })),
}));

const { useAdminStore } = await import("@/stores/admin");

const DEFAULT_PARAMS = {
  ROUND_DURATION_DAYS: "14",
  NIL_REGEN_MINUTES: "5",
  GIG_COOLDOWN_MINUTES: "10",
  PVP_NIL_COST: "20",
  INITIAL_BALANCE: "500",
  GIG_BASE_REWARD: "100",
  MAX_CREW_SIZE: "4",
};

function renderView() {
  return render(
    <MemoryRouter>
      <ParamsTab />
    </MemoryRouter>,
  );
}

describe("ParamsTab", () => {
  beforeEach(() => {
    useAdminStore.setState({ ...storeMocks.initial });
    vi.clearAllMocks();
  });

  it("should render every param input with its PT label", () => {
    useAdminStore.setState({ params: { ...DEFAULT_PARAMS } });

    renderView();

    expect(screen.getByText("Duração da Rodada (dias)")).toBeInTheDocument();
    expect(screen.getByText("Regen de NIL (minutos)")).toBeInTheDocument();
    expect(screen.getByText("Cooldown de trampos (minutos)")).toBeInTheDocument();
    expect(screen.getByText("Custo de NIL no PvP")).toBeInTheDocument();
    expect(screen.getByText("Saldo Inicial (Grana)")).toBeInTheDocument();
    // ND-052: GIG_BASE_REWARD label.
    expect(screen.getByText("Recompensa Mínima de Trampos (G$)")).toBeInTheDocument();
    expect(screen.getByText("Tamanho Máx. do Bonde")).toBeInTheDocument();

    // Inputs are populated with the current values.
    expect(screen.getByDisplayValue("14")).toBeInTheDocument();
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
  });

  it("should save edited values via the store on submit", async () => {
    const user = userEvent.setup();
    useAdminStore.setState({ params: { ...DEFAULT_PARAMS } });
    const updateParams = vi.fn().mockResolvedValue(undefined);
    useAdminStore.setState({ updateParams });

    renderView();

    const saveButton = screen.getByRole("button", { name: "Salvar" });
    expect(saveButton).toBeDisabled(); // no changes yet

    const nilInput = screen.getByDisplayValue("20");
    await user.clear(nilInput);
    await user.type(nilInput, "25");

    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    expect(updateParams).toHaveBeenCalledWith(
      expect.objectContaining({ PVP_NIL_COST: "25", GIG_BASE_REWARD: "100" }),
    );
    expect(await screen.findByText("✓ Parâmetros salvos")).toBeInTheDocument();
  });

  it("should show the store error when params fail to load", () => {
    useAdminStore.setState({ paramsError: "Falha ao carregar parâmetros" });

    renderView();

    expect(screen.getByText("Falha ao carregar parâmetros")).toBeInTheDocument();
  });
});
