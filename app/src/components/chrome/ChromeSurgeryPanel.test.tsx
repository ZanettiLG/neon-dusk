import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ChromeSurgeryPanel from "@/components/chrome/ChromeSurgeryPanel";
import { useAuthStore } from "@/stores/auth";
import { useHudStore } from "@/stores/hud";
import type { Character, ChromeDefinition, ChromeSlot, InstalledChromeResponse } from "@neon-dusk/shared";

// Issue #10 — painel de cirurgia: fluxo idle → slot → implant → reviewing →
// confirming → surgery_playing (teatro ~5s) → done. Antes/depois computado no
// cliente; custo visível antes de confirmar; bloqueios por grana/humanidade/
// slot; reduced-motion colapsa o teatro; hud refresh é disparado pelo done.

const mocks = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/api/client", () => ({
  api: mocks.api,
}));

const originalMatchMedia = window.matchMedia;

function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function restoreMatchMedia() {
  window.matchMedia = originalMatchMedia as typeof window.matchMedia;
}

const CHARACTER: Character = {
  id: "c1",
  userId: "u1",
  name: "Teste",
  origin: "o_fervo",
  role: "bicho",
  streetCred: 0,
  maxStreetCredAchieved: 0,
  ability: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  body: 4,
  reflexes: 3,
  intelligence: 5,
  technical: 3,
  cool: 4,
};

const CUCA: ChromeDefinition = {
  id: "cuca",
  slug: "neural-booster",
  name: "Cuca Acesa",
  slot: "frontal_cortex",
  tier: 1,
  bonuses: { intelligence: 2, nil_max: 10 },
  humanityCost: 3,
  basePrice: 1500,
  description: "Aprimoramento neural básico.",
};

const INSTALLED: InstalledChromeResponse = {
  installed: [],
  effectiveHumanity: 70,
  humanitySpent: 3,
  statBonus: { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 },
  hpBonus: 0,
  gigSuccessBonus: 0,
  nilMaxBonus: 0,
};

function installedWith(overrides: Partial<InstalledChromeResponse>): InstalledChromeResponse {
  return { ...INSTALLED, ...overrides };
}

interface RenderOptions {
  slot?: ChromeSlot | null;
  catalog?: ChromeDefinition[];
  installed?: InstalledChromeResponse;
  vendorId?: string | null;
  loading?: boolean;
}

function renderPanel(options: RenderOptions = {}) {
  const onSurgeryDone = vi.fn();
  render(
    <ChromeSurgeryPanel
      slot={options.slot === undefined ? "frontal_cortex" : options.slot}
      catalog={options.catalog ?? [CUCA]}
      installed={options.installed ?? INSTALLED}
      vendorId={options.vendorId === undefined ? "v1" : options.vendorId}
      loading={options.loading ?? false}
      onSurgeryDone={onSurgeryDone}
    />,
  );
  return { onSurgeryDone };
}

describe("ChromeSurgeryPanel", () => {
  beforeEach(() => {
    mocks.api.post.mockReset();
    mocks.api.post.mockResolvedValue({});
    useAuthStore.setState({ character: CHARACTER });
    useHudStore.setState({ balance: 5000, humanity: 70 });
  });

  afterEach(() => {
    restoreMatchMedia();
    vi.useRealTimers();
  });

  it("should show the idle prompt when no slot is selected", () => {
    renderPanel({ slot: null });

    expect(screen.getByText(/Selecione um slot no mapa corporal/)).toBeInTheDocument();
  });

  it("should show an empty-slot message when the catalog has no implant for the slot", () => {
    renderPanel({ slot: "skeleton", catalog: [CUCA] });

    expect(screen.getByText("Nenhum cromo para este slot.")).toBeInTheDocument();
  });

  it("should list the slot-filtered catalog and disable already-installed implants", () => {
    const withCuca = installedWith({
      installed: [
        {
          installedId: "i1",
          installedAt: "2026-01-01T00:00:00.000Z",
          definition: CUCA,
        },
      ],
    });
    renderPanel({ installed: withCuca });

    expect(screen.getByRole("button", { name: /Cuca Acesa/ })).toBeDisabled();
  });

  it("should show cost and computed before/after BEFORE confirming", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));

    // Custo visível antes do confirm.
    expect(screen.getByText("Custo: G$ 1.500")).toBeInTheDocument();
    expect(screen.getByText("-3 humanidade")).toBeInTheDocument();

    // Antes/depois client-side: INT 5 → 7 (character 5 + statBonus 0 + bônus 2).
    expect(screen.getByText("5 → 7 ▲")).toBeInTheDocument();
    // NIL máx +0 → +10 (nil_max do cromo).
    expect(screen.getByText("+0 → +10")).toBeInTheDocument();
    // Humanidade 70 → 67.
    expect(screen.getByText(/→ 67/)).toBeInTheDocument();
    expect(screen.getByText("Humanidade pós-cirurgia")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Confirmar cirurgia" })).toBeEnabled();
  });

  it("should block the confirm by grana (balance below price)", () => {
    useHudStore.setState({ balance: 100 });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));

    expect(screen.getByText(/⛔ Grana insuficiente\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cirurgia" })).toBeDisabled();
    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it("should block the confirm by humanity (would go below 0)", () => {
    renderPanel({ installed: installedWith({ effectiveHumanity: 2 }) });

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));

    expect(screen.getByText(/⛔ Humanidade insuficiente\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cirurgia" })).toBeDisabled();
    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it("should block the confirm when the slot is full", () => {
    const fullSlot = installedWith({
      installed: ["i1", "i2", "i3"].map((id) => ({
        installedId: id,
        installedAt: "2026-01-01T00:00:00.000Z",
        definition: { ...CUCA, id: `def-${id}` },
      })),
    });
    renderPanel({ installed: fullSlot });

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));

    expect(screen.getByText(/⛔ Slot cheio\./)).toBeInTheDocument();
    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it("should play the full flow: confirm → POST → theater → done → onSurgeryDone", async () => {
    stubMatchMedia(false);
    vi.useFakeTimers();
    const { onSurgeryDone } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirmar cirurgia" }));
    });

    expect(mocks.api.post).toHaveBeenCalledWith("/api/chrome/install", {
      chromeDefinitionId: "cuca",
      vendorId: "v1",
    });

    // Teatro: batimento neural + log digitado + botão em cooldown, aria-live.
    const theater = screen.getByRole("status");
    expect(theater).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText(/BATIMENTO NEURAL/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ferro esfriando/ })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));

    expect(onSurgeryDone).toHaveBeenCalledTimes(1);
    expect(screen.getByText("✓ Cirurgia concluída. Cromo instalado: Cuca Acesa.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(screen.getByRole("button", { name: /Cuca Acesa/ })).toBeInTheDocument();
  });

  it("should collapse the theater to done immediately under prefers-reduced-motion", async () => {
    stubMatchMedia(true);
    vi.useFakeTimers();
    const { onSurgeryDone } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirmar cirurgia" }));
    });

    act(() => vi.advanceTimersByTime(0));

    expect(onSurgeryDone).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Cirurgia concluída/)).toBeInTheDocument();
  });

  it("should surface the API error on the confirm and allow retry", async () => {
    mocks.api.post.mockRejectedValue(new Error("Grana insuficiente."));
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirmar cirurgia" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Grana insuficiente.");
    expect(screen.getByRole("button", { name: "Confirmar cirurgia" })).toBeEnabled();
  });
});
