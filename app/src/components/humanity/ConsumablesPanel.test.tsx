import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConsumablesPanel from "@/components/humanity/ConsumablesPanel";
import { useConsumablesStore } from "@/stores/consumables";
import type { ConsumablesResponse, HumanityInfo } from "@neon-dusk/shared";

// Issue #48 — Consumables panel render tests. The panel is self-contained:
// it reads the consumables store (seeded here) and receives the HumanityInfo
// readout as a prop for the pro-active gating (flatline / banda Íntegro).

const mocks = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    code: string;
    details?: unknown;
    constructor(status: number, code: string, message: string, details?: unknown) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }
  return {
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    hudRefresh: vi.fn(),
    humanityFetch: vi.fn(),
    ApiError,
  };
});

vi.mock("@/api/client", () => ({
  api: mocks.api,
  ApiError: mocks.ApiError,
}));

// The store pings these via getState() after a successful use — mock them so
// no real fetch fires (the seeded store fetch is a no-op for the panel tests).
vi.mock("@/stores/hud", () => ({
  useHudStore: { getState: () => ({ refresh: mocks.hudRefresh }) },
}));

vi.mock("@/stores/humanity", () => ({
  useHumanityStore: { getState: () => ({ fetch: mocks.humanityFetch }) },
}));

// Canonical catalog fixture (mirrors server/src/content/consumables.ts).
// `id` follows the real API contract (UUID — validated by z.string().uuid()).
const sampleItems: ConsumablesResponse["items"] = [
  {
    id: "a1b2c3d4-0000-4000-8000-000000000001",
    slug: "estabilizador",
    name: "Estabilizador",
    tier: 1,
    restoreAmount: 5,
    cooldownHours: 0,
    ownedQuantity: 1,
    nextAvailableAt: null,
  },
  {
    id: "a1b2c3d4-0000-4000-8000-000000000002",
    slug: "freio",
    name: "Freio",
    tier: 2,
    restoreAmount: 10,
    cooldownHours: 12,
    ownedQuantity: 2,
    nextAvailableAt: null,
  },
  {
    id: "a1b2c3d4-0000-4000-8000-000000000003",
    slug: "choque",
    name: "Choque",
    tier: 3,
    restoreAmount: 15,
    cooldownHours: 24,
    ownedQuantity: 0,
    nextAvailableAt: null,
  },
];

function info(overrides: Partial<HumanityInfo> = {}): HumanityInfo {
  return {
    humanity: 50,
    band: "instavel",
    flatlined: false,
    flatlinedAt: null,
    scrubber: { installed: false, pendingRegen: 0, nextRegenAt: null, cap: 50 },
    therapy: {
      lastCompletedAt: null,
      nextAvailableAt: null,
      cooldownRemainingMs: 0,
      clinic: {
        therapyType: "clinic",
        costMin: 5000,
        costMax: 20000,
        restoreMin: 10,
        restoreMax: 20,
      },
      attunement: {
        therapyType: "attunement",
        costMin: 2500,
        costMax: 10000,
        restoreMin: 5,
        restoreMax: 10,
      },
    },
    ...overrides,
  };
}

const useResponse = {
  humanityBefore: 50,
  humanityAfter: 55,
  restored: 5,
  costEddies: 0,
  nextAvailableAt: null,
};

describe("ConsumablesPanel", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
    mocks.hudRefresh.mockReset();
    mocks.humanityFetch.mockReset();
    // Safe default for any accidental real-store call (HUD refresh reads 4
    // endpoints; a resolved object keeps `numField`/`.balance` reads safe).
    mocks.api.get.mockResolvedValue({});
    useConsumablesStore.setState({
      items: sampleItems,
      loading: false,
      error: null,
      useError: null,
      usingItemId: null,
      lastUse: null,
      // Fetch on mount is a no-op — the tests drive the seeded state directly.
      fetch: async () => {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render the items with name, restore amount and owned quantity", () => {
    render(<ConsumablesPanel info={info()} />);

    expect(screen.getByText("CONSUMÍVEIS")).toBeInTheDocument();
    expect(screen.getByText("Estabilizador")).toBeInTheDocument();
    expect(screen.getByText("Freio")).toBeInTheDocument();
    expect(screen.getByText("Choque")).toBeInTheDocument();
    expect(screen.getByText("restaura +5")).toBeInTheDocument();
    expect(screen.getByText("restaura +10")).toBeInTheDocument();
    expect(screen.getByText("restaura +15")).toBeInTheDocument();
    expect(screen.getByText("1 em estoque")).toBeInTheDocument();
    expect(screen.getByText("2 em estoque")).toBeInTheDocument();
    expect(screen.getByText("0 em estoque")).toBeInTheDocument();
    // Static diminishing-returns copy (ADR 28-B).
    expect(screen.getByText(/Restauração reduzida após usos repetidos/)).toBeInTheDocument();
  });

  it("should disable the button when the player owns none of the item", () => {
    render(<ConsumablesPanel info={info()} />);

    const outOfStock = screen.getByRole("button", { name: "Sem estoque" });
    expect(outOfStock).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Usar" })).toHaveLength(2);
  });

  it("should require the 2-step confirmation before calling the use endpoint", async () => {
    mocks.api.post.mockResolvedValue(useResponse);
    const user = userEvent.setup();

    render(<ConsumablesPanel info={info()} />);

    // 1st click arms the confirmation — no API call yet.
    await user.click(screen.getAllByRole("button", { name: "Usar" })[0]);
    expect(mocks.api.post).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirmar uso?" })).toBeInTheDocument();

    // 2nd click fires the use with the correct itemId (UUID contract).
    await user.click(screen.getByRole("button", { name: "Confirmar uso?" }));
    expect(mocks.api.post).toHaveBeenCalledWith("/api/consumables/use", {
      itemId: "a1b2c3d4-0000-4000-8000-000000000001",
    });
    // The confirmation resets after the call.
    expect(screen.queryByRole("button", { name: "Confirmar uso?" })).not.toBeInTheDocument();
  });

  it("should show the green success message with the restored humanity", async () => {
    mocks.api.post.mockResolvedValue(useResponse);
    const user = userEvent.setup();

    render(<ConsumablesPanel info={info()} />);

    await user.click(screen.getAllByRole("button", { name: "Usar" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirmar uso?" }));

    const message = await screen.findByText("Estabilizador: +5 de humanidade (50 → 55).");
    expect(message).toBeInTheDocument();
    expect(message).toHaveClass("text-nd-green");
  });

  it("should show the COOLDOWN_ACTIVE error with a countdown from nextAvailableAt", async () => {
    vi.useFakeTimers();
    const unlock = new Date(Date.now() + 12 * 3600_000).toISOString();
    mocks.api.post.mockRejectedValue(
      new mocks.ApiError(429, "COOLDOWN_ACTIVE", "Ação em cooldown.", { nextAvailableAt: unlock }),
    );

    render(<ConsumablesPanel info={info()} />);

    // fireEvent + act(async) is the repo pattern for fake-timer click flows
    // (ChromeSurgeryPanel.test.tsx) — it flushes the rejection microtask chain.
    fireEvent.click(screen.getAllByRole("button", { name: "Usar" })[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirmar uso?" }));
    });

    const message = screen.getByText("Este item ainda está em cooldown. Disponível em 12h.");
    expect(message).toBeInTheDocument();
    expect(message).toHaveClass("text-nd-magenta");
  });

  it("should show the BAND_TOO_HIGH error message", async () => {
    mocks.api.post.mockRejectedValue(
      new mocks.ApiError(
        400,
        "BAND_TOO_HIGH",
        "Sua humanidade está alta demais para isso (máx. 70).",
      ),
    );
    const user = userEvent.setup();

    render(<ConsumablesPanel info={info()} />);

    await user.click(screen.getAllByRole("button", { name: "Usar" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirmar uso?" }));

    expect(
      await screen.findByText("Sua humanidade está alta demais para isso (máx. 70)."),
    ).toBeInTheDocument();
  });

  it("should show the DIMINISHING_RETURNS_EXHAUSTED error message", async () => {
    mocks.api.post.mockRejectedValue(
      new mocks.ApiError(
        400,
        "DIMINISHING_RETURNS_EXHAUSTED",
        "Máximo de 3 usos por 24h atingido.",
      ),
    );
    const user = userEvent.setup();

    render(<ConsumablesPanel info={info()} />);

    await user.click(screen.getAllByRole("button", { name: "Usar" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirmar uso?" }));

    expect(await screen.findByText("Máximo de 3 usos por 24h atingido.")).toBeInTheDocument();
  });

  it("should show the NOT_OWNED error message", async () => {
    mocks.api.post.mockRejectedValue(
      new mocks.ApiError(400, "NOT_OWNED", "Você não tem este item no inventário."),
    );
    const user = userEvent.setup();

    render(<ConsumablesPanel info={info()} />);

    await user.click(screen.getAllByRole("button", { name: "Usar" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirmar uso?" }));

    expect(await screen.findByText("Você não tem este item no inventário.")).toBeInTheDocument();
  });

  it("should show the CONSUMABLE_NOT_FOUND error message", async () => {
    mocks.api.post.mockRejectedValue(
      new mocks.ApiError(404, "CONSUMABLE_NOT_FOUND", "Item não encontrado."),
    );
    const user = userEvent.setup();

    render(<ConsumablesPanel info={info()} />);

    await user.click(screen.getAllByRole("button", { name: "Usar" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirmar uso?" }));

    expect(await screen.findByText("Item não encontrado.")).toBeInTheDocument();
  });

  it("should show the RATE_LIMITED error message", async () => {
    mocks.api.post.mockRejectedValue(
      new mocks.ApiError(429, "RATE_LIMITED", "Muitas requisições. Aguarde."),
    );
    const user = userEvent.setup();

    render(<ConsumablesPanel info={info()} />);

    await user.click(screen.getAllByRole("button", { name: "Usar" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirmar uso?" }));

    expect(await screen.findByText("Muitas requisições. Aguarde.")).toBeInTheDocument();
  });

  it("should show the UNAUTHORIZED error message", async () => {
    mocks.api.post.mockRejectedValue(
      new mocks.ApiError(401, "UNAUTHORIZED", "Sessão expirada. Faça login novamente."),
    );
    const user = userEvent.setup();

    render(<ConsumablesPanel info={info()} />);

    await user.click(screen.getAllByRole("button", { name: "Usar" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirmar uso?" }));

    expect(await screen.findByText("Sessão expirada. Faça login novamente.")).toBeInTheDocument();
  });

  it("should format a COOLDOWN_ACTIVE error longer than 24h as days and hours", async () => {
    vi.useFakeTimers();
    const unlock = new Date(Date.now() + 30 * 3600_000).toISOString();
    mocks.api.post.mockRejectedValue(
      new mocks.ApiError(429, "COOLDOWN_ACTIVE", "Este item ainda está em cooldown.", {
        nextAvailableAt: unlock,
      }),
    );

    render(<ConsumablesPanel info={info()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Usar" })[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirmar uso?" }));
    });

    expect(
      screen.getByText("Este item ainda está em cooldown. Disponível em 1d 6h."),
    ).toBeInTheDocument();
  });

  it("should block every button for a flatlined character", () => {
    render(<ConsumablesPanel info={info({ flatlined: true })} />);

    expect(screen.getAllByText("⛔ Personagem apagado. Sem ações permitidas.")).toHaveLength(3);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("should block every button when the band is Íntegro", () => {
    render(<ConsumablesPanel info={info({ band: "integro" })} />);

    expect(
      screen.getAllByText("⛔ Sua humanidade está alta demais para isso (máx. 70)."),
    ).toHaveLength(3);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("should show the item cooldown with a live countdown for a future nextAvailableAt", () => {
    vi.useFakeTimers();
    const nextAvailableAt = new Date(Date.now() + 2 * 3600_000).toISOString();
    useConsumablesStore.setState({
      items: [{ ...sampleItems[1], nextAvailableAt }],
    });

    render(<ConsumablesPanel info={info()} />);

    const button = screen.getByRole("button", { name: /Cooldown/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Cooldown 120:00");

    act(() => vi.advanceTimersByTime(60_000));
    expect(button).toHaveTextContent("Cooldown 119:00");
  });

  it("should render the loading skeleton while the catalog is being fetched", () => {
    useConsumablesStore.setState({ items: null, loading: true, error: null });

    const { container } = render(<ConsumablesPanel info={info()} />);

    expect(screen.getByText("CONSUMÍVEIS")).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("should render the empty state when the catalog has no items", () => {
    useConsumablesStore.setState({ items: [], loading: false, error: null });

    render(<ConsumablesPanel info={info()} />);

    expect(screen.getByText("Nenhum consumível disponível.")).toBeInTheDocument();
  });

  it("should render the fetch error with a retry action", () => {
    useConsumablesStore.setState({
      items: null,
      loading: false,
      error: "Falha ao carregar consumíveis",
    });

    render(<ConsumablesPanel info={info()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao carregar consumíveis");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("should call fetch again when the retry button is clicked", () => {
    const fetchSpy = vi.fn();
    useConsumablesStore.setState({
      items: null,
      loading: false,
      error: "Falha ao carregar consumíveis",
      fetch: fetchSpy,
    });

    render(<ConsumablesPanel info={info()} />);

    // Mount effect already fired one fetch; the retry must fire a second one.
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("should show the loading state on the button while the use is in flight", async () => {
    let resolvePost!: (value: unknown) => void;
    mocks.api.post.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    const user = userEvent.setup();

    render(<ConsumablesPanel info={info()} />);

    await user.click(screen.getAllByRole("button", { name: "Usar" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirmar uso?" }));

    // The POST is pending — exactly one button is busy (the armed item).
    const busy = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-busy") === "true");
    expect(busy).toHaveLength(1);
    expect(busy[0]).toBeDisabled();

    await act(async () => {
      resolvePost(useResponse);
    });

    expect(
      await screen.findByText("Estabilizador: +5 de humanidade (50 → 55)."),
    ).toBeInTheDocument();
  });
});
