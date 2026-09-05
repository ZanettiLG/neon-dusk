import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ChromeSurgeryPanel, { isOverclockActive } from "@/components/chrome/ChromeSurgeryPanel";
import { stubMatchMedia, restoreMatchMedia } from "@/test-utils/matchMedia";
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

/** Gambiarrista com Overclock pendente (one-shot: activeUntil é flag, não timer). */
const OVERCLOCK_CHARACTER: Character = {
  ...CHARACTER,
  role: "gambiarrista",
  ability: {
    abilityType: "overclock",
    isActive: false, // API flag só reflete timestamp futuro — o mirror usa os timestamps crus
    activeUntil: "2026-01-01T00:00:00.000Z",
    cooldownUntil: null,
    cooldownRemainingMs: 0,
  },
};

/** Gambiarrista cujo cooldown do Overclock já expirou → habilidade pronta (não ativa). */
const OVERCLOCK_COOLDOWN_EXPIRED: Character = {
  ...CHARACTER,
  role: "gambiarrista",
  ability: {
    abilityType: "overclock",
    isActive: false,
    activeUntil: null,
    cooldownUntil: "2026-01-01T00:00:00.000Z",
    cooldownRemainingMs: 0,
  },
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
  installed?: InstalledChromeResponse | null;
  vendorId?: string | null;
  vendorPrices?: Record<string, number> | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function renderPanel(options: RenderOptions = {}) {
  const onSurgeryDone = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <ChromeSurgeryPanel
      slot={options.slot === undefined ? "frontal_cortex" : options.slot}
      catalog={options.catalog ?? [CUCA]}
      installed={options.installed === undefined ? INSTALLED : options.installed}
      vendorId={options.vendorId === undefined ? "v1" : options.vendorId}
      vendorPrices={options.vendorPrices}
      loading={options.loading ?? false}
      error={options.error}
      onRetry={options.onRetry}
      onSurgeryDone={onSurgeryDone}
      onClose={onClose}
    />,
  );
  return { onSurgeryDone, onClose, unmount: utils.unmount };
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

  it("should block the confirm when no ferrageiro (vendor) is available", () => {
    renderPanel({ vendorId: null });

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));

    expect(screen.getByText(/⛔ Nenhum ferrageiro disponível\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cirurgia" })).toBeDisabled();
    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it("should go back to the slot picker via the trocar button", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));
    expect(screen.getByText("Custo: G$ 1.500")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "trocar" }));

    // Back on the slot picker: catalog list again, review screen gone.
    expect(screen.getByRole("button", { name: /Cuca Acesa/ })).toBeInTheDocument();
    expect(screen.queryByText("Custo: G$ 1.500")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar cirurgia" })).not.toBeInTheDocument();
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

    // Teatro: batimento neural + log digitado + botão em cooldown.
    // role="status" já implica aria-live polite — sem atributo redundante.
    const theater = screen.getByRole("status");
    expect(theater).not.toHaveAttribute("aria-live");
    expect(screen.getByText(/BATIMENTO NEURAL/)).toBeInTheDocument();
    // Cooldown ~5s client-side (critério #10): "ferro esfriando 0:05".
    expect(screen.getByRole("button", { name: "ferro esfriando 0:05" })).toBeInTheDocument();

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

  it("should show the installed error with a retry instead of hanging in loading forever", () => {
    const onRetry = vi.fn();
    renderPanel({ installed: null, error: "Falha ao carregar cromo instalado", onRetry });

    expect(screen.getByText("Não foi possível carregar seu cromo. Tente novamente.")).toBeInTheDocument();
    expect(screen.queryByText("▌ loading...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should hide implants the ferrageiro does not carry when vendor stock is known", () => {
    renderPanel({ vendorPrices: { outro: 2000 } });

    expect(screen.queryByRole("button", { name: /Cuca Acesa/ })).not.toBeInTheDocument();
    expect(screen.getByText("O ferrageiro não tem cromo em estoque para este slot.")).toBeInTheDocument();
  });

  it("should keep offering implants the ferrageiro carries when vendor stock is known", () => {
    renderPanel({ vendorPrices: { cuca: 2000 } });

    expect(screen.getByRole("button", { name: /Cuca Acesa/ })).toBeInTheDocument();
  });

  it("should fall back to the full slot catalog when vendor stock is unknown", () => {
    renderPanel({ vendorPrices: null });

    expect(screen.getByRole("button", { name: /Cuca Acesa/ })).toBeInTheDocument();
  });

  it("should use the ferrageiro stock price when provided (vendor price > catalog basePrice)", () => {
    useHudStore.setState({ balance: 1800 });
    renderPanel({ vendorPrices: { cuca: 2000 } });

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));

    // Custo mostra o preço do estoque, não o basePrice do catálogo (G$ 1.500).
    expect(screen.getByText("Custo: G$ 2.000")).toBeInTheDocument();
    // 1800 < 2000 → bloqueia, embora 1800 > basePrice.
    expect(screen.getByText(/⛔ Grana insuficiente\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cirurgia" })).toBeDisabled();
  });

  it("should allow the confirm when the balance covers the vendor price but not the basePrice drift", () => {
    useHudStore.setState({ balance: 2200 });
    renderPanel({ vendorPrices: { cuca: 2000 } });

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));

    expect(screen.getByText("Custo: G$ 2.000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cirurgia" })).toBeEnabled();
  });

  it("should apply Overclock: half price, zero humanity, no block for a poor gambiarrista", () => {
    useAuthStore.setState({ character: OVERCLOCK_CHARACTER });
    useHudStore.setState({ balance: 800 }); // ceil(1500 * 0.5) = 750
    renderPanel({ installed: installedWith({ effectiveHumanity: 2 }) }); // custo normal 3 bloquearia

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));

    expect(screen.getByText("Custo: G$ 750")).toBeInTheDocument();
    expect(screen.getByText("-0 humanidade")).toBeInTheDocument();
    expect(screen.getByText("Overclock ativo: metade do preço, zero de humanidade.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cirurgia" })).toBeEnabled();
    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it("should still block grana under Overclock when the halved vendor price exceeds the balance", () => {
    useAuthStore.setState({ character: OVERCLOCK_CHARACTER });
    useHudStore.setState({ balance: 900 }); // ceil(2000 * 0.5) = 1000
    renderPanel({ vendorPrices: { cuca: 2000 } });

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));

    expect(screen.getByText("Custo: G$ 1.000")).toBeInTheDocument();
    expect(screen.getByText(/⛔ Grana insuficiente\./)).toBeInTheDocument();
    // Sem bloqueio de humanidade (custo 0 com Overclock).
    expect(screen.queryByText(/Humanidade insuficiente\./)).not.toBeInTheDocument();
  });

  it("should NOT apply Overclock when the cooldown already expired (ability ready)", () => {
    useAuthStore.setState({ character: OVERCLOCK_COOLDOWN_EXPIRED });
    useHudStore.setState({ balance: 800 }); // sem desconto: 1500 > 800
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));

    expect(screen.getByText("Custo: G$ 1.500")).toBeInTheDocument();
    expect(screen.getByText(/⛔ Grana insuficiente\./)).toBeInTheDocument();
  });
});

describe("isOverclockActive (mirror of server getOverclockBonus)", () => {
  it("should be false for non-gambiarristas and null characters", () => {
    expect(isOverclockActive(null)).toBe(false);
    expect(isOverclockActive(CHARACTER)).toBe(false);
    expect(isOverclockActive(OVERCLOCK_COOLDOWN_EXPIRED, 0)).toBe(false);
  });

  it("should be true while the one-shot is pending consumption, even with a past activeUntil", () => {
    // activeUntil no passado continua ativo (one-shot não expira sozinho),
    // espelhando resolveAbilityState — o flag isActive da API é irrelevante.
    expect(isOverclockActive(OVERCLOCK_CHARACTER, Date.parse("2026-06-01T00:00:00.000Z"))).toBe(true);
  });

  it("should be false once the cooldown has expired", () => {
    const expired: Character = {
      ...OVERCLOCK_CHARACTER,
      ability: {
        abilityType: "overclock",
        isActive: false,
        activeUntil: "2026-01-01T00:00:00.000Z",
        cooldownUntil: "2026-01-01T00:00:00.000Z",
        cooldownRemainingMs: 0,
      },
    };
    expect(isOverclockActive(expired, Date.parse("2026-06-01T00:00:00.000Z"))).toBe(false);
  });
});

describe("ChromeSurgeryPanel — picker modal (issue #188 emenda 1)", () => {
  const T2: ChromeDefinition = {
    id: "olho-vidro",
    slug: "olho-vidro",
    name: "Olho de Vidro",
    slot: "frontal_cortex",
    tier: 2,
    bonuses: { cool: 1 },
    humanityCost: 4,
    basePrice: 2200,
    description: "Lente ocular de reposição.",
  };
  const T3: ChromeDefinition = {
    id: "diamante-bruto",
    slug: "diamante-bruto",
    name: "Diamante Bruto",
    slot: "frontal_cortex",
    tier: 3,
    bonuses: { body: 2, gig_success_rate: 5 },
    humanityCost: 6,
    basePrice: 3000,
    description: "Blindagem dérmica pesada.",
  };

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

  it("should render the picker inside an accessible modal labelled with slot occupancy", () => {
    renderPanel();

    // Modal shell: role="dialog", aria-modal, named by the occupancy title.
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByRole("heading", { level: 2, name: "Córtex Frontal — 0/3 ocupados" }),
    ).toBeInTheDocument();

    // Two-pane: list on the left, detail on the right (default = first item).
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("Aprimoramento neural básico.")).toBeInTheDocument();
    expect(screen.getByText("+2 Intelligence · +10 NIL máx")).toBeInTheDocument();
    // Price appears in both panes (item row + detail).
    expect(screen.getAllByText("G$ 1.500")).toHaveLength(2);
    expect(screen.getByText(/-3 humanidade/)).toBeInTheDocument();
    expect(screen.getByText("0/3 ocupados — 3 vagas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Instalar" })).toBeInTheDocument();

    // Default selection = first item, marked aria-current.
    expect(screen.getByRole("button", { name: /Cuca Acesa/ })).toHaveAttribute("aria-current", "true");
  });

  it("should show the tier monogram fallback while icons are not shipped (#189)", () => {
    renderPanel({ catalog: [CUCA, T2, T3] });

    const item = (name: RegExp) => screen.getByRole("button", { name });
    // Monogram = first grapheme of the name (CHROME_ICON_ASSETS is empty in #188).
    const t1Icon = item(/Cuca Acesa/).querySelector<HTMLElement>("span[aria-hidden] > span");
    expect(t1Icon).toHaveTextContent("C");
    expect(t1Icon!.parentElement).toHaveClass("border-nd-text-secondary/40", "text-nd-text-secondary");
    expect(item(/Olho de Vidro/).querySelector("span[aria-hidden]")!.className).toContain("border-nd-cyan/40");
    expect(item(/Diamante Bruto/).querySelector("span[aria-hidden]")!.className).toContain("border-nd-gold/40");

    // Tier is never color-only: T1/T2/T3 always present as text.
    expect(item(/Olho de Vidro/).textContent).toContain("T2 ·");
    expect(item(/Diamante Bruto/).textContent).toContain("T3 ·");
  });

  it("should drive the detail pane from hover, focus, and click", () => {
    renderPanel({ catalog: [CUCA, T3] });

    const cuca = screen.getByRole("button", { name: /Cuca Acesa/ });
    const diamante = screen.getByRole("button", { name: /Diamante Bruto/ });

    // Hover drives the detail.
    fireEvent.mouseEnter(diamante);
    expect(screen.getByText("Blindagem dérmica pesada.")).toBeInTheDocument();
    expect(screen.queryByText("Aprimoramento neural básico.")).not.toBeInTheDocument();
    expect(diamante).toHaveAttribute("aria-current", "true");
    expect(cuca).not.toHaveAttribute("aria-current");

    // Focus drives the detail (keyboard parity).
    fireEvent.focus(cuca);
    expect(screen.getByText("Aprimoramento neural básico.")).toBeInTheDocument();
    expect(cuca).toHaveAttribute("aria-current", "true");

    // Click goes to the review screen for the clicked implant.
    fireEvent.click(diamante);
    expect(screen.getByRole("heading", { level: 3, name: "Diamante Bruto" })).toBeInTheDocument();
    expect(screen.getByText("Custo: G$ 3.000")).toBeInTheDocument();
  });

  it("should rove focus with ArrowDown/ArrowUp/Home/End", () => {
    renderPanel({ catalog: [CUCA, T2, T3] });

    // initialFocusRef lands on the first item of the list.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Cuca Acesa/ }));

    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Olho de Vidro/ }));

    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Cuca Acesa/ }));

    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Diamante Bruto/ }));

    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Olho de Vidro/ }));
  });

  it("should close on Escape and restore focus to the opener on unmount", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { onClose, unmount } = renderPanel();

    // Focus moved into the dialog (initialFocusRef = first list item).
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Cuca Acesa/ }));

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Deactivation path restores focus to the opener (the body-map label).
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("should trap Tab cycles inside the dialog", () => {
    renderPanel();

    const close = screen.getByRole("button", { name: "Fechar" });
    close.focus();
    // Shift+Tab from the first focusable wraps to the last (Instalar).
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Instalar" }));
    // Tab from the last wraps back to the first.
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(document.activeElement).toBe(close);
  });

  it("should close on overlay click and via the header ✕ outside the theater", () => {
    const { onClose } = renderPanel();

    fireEvent.click(screen.getByRole("dialog").previousElementSibling as Element);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("should lock the modal during the theater: Esc, overlay and ✕ cannot close", async () => {
    stubMatchMedia(false);
    vi.useFakeTimers();
    const { onClose, onSurgeryDone } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Cuca Acesa/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirmar cirurgia" }));
    });

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.click(dialog.previousElementSibling as Element);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));
    expect(onSurgeryDone).toHaveBeenCalledTimes(1);
  });
});
