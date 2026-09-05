import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import ChromeView from "@/views/ChromeView";
import type { ChromeDefinition, InstalledChromeResponse, VendorWithInventory } from "@neon-dusk/shared";

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

const implant: ChromeDefinition = {
  id: "ch1",
  slug: "smart-link",
  name: "Smart Link",
  slot: "nervous_system",
  tier: 2,
  bonuses: { gig_success_rate: 10 },
  humanityCost: 5,
  basePrice: 500,
  description: "Mira assistida.",
};

const implant2: ChromeDefinition = {
  id: "ch2",
  slug: "mira-plasma",
  name: "Mira de Plasma",
  slot: "nervous_system",
  tier: 3,
  bonuses: { gig_success_rate: 15 },
  humanityCost: 8,
  basePrice: 300,
  description: "Mira quente.",
};

/** Ferrageiro detail — o estoque cobra G$ 800/900, não os basePrice do catálogo. */
const RIPPER_DETAIL: VendorWithInventory = {
  vendor: { id: "v1", name: "Ferrageiro", type: "RIPPERDOC", district: "o_fervo" },
  inventory: [
    {
      id: "inv1",
      vendorId: "v1",
      itemType: "CHROME",
      itemId: "smart-link",
      price: 800,
      stock: -1,
      chromeDefinitionId: "ch1",
      chromeDefinitionName: "Smart Link",
      humanityCost: 5,
    },
    {
      id: "inv2",
      vendorId: "v1",
      itemType: "CHROME",
      itemId: "mira-plasma",
      price: 900,
      stock: -1,
      chromeDefinitionId: "ch2",
      chromeDefinitionName: "Mira de Plasma",
      humanityCost: 8,
    },
  ],
};

/** Default API mock: catalog/installed/vendors + ferrageiro detail. */
function mockApi(overrides: Record<string, unknown> = {}) {
  mocks.api.get.mockImplementation((url: string) => {
    if (url === "/api/chrome") return Promise.resolve([implant, implant2]);
    if (url === "/api/chrome/installed") return Promise.resolve(installed);
    if (url === "/api/vendors") return Promise.resolve([{ id: "v1", type: "RIPPERDOC" }]);
    if (url === "/api/vendors/v1") return Promise.resolve(RIPPER_DETAIL);
    if (url in overrides) return Promise.resolve(overrides[url]);
    return Promise.resolve([]);
  });
}

const installed: InstalledChromeResponse = {
  installed: [
    {
      installedId: "i1",
      installedAt: "2026-01-01T00:00:00.000Z",
      definition: implant,
    },
  ],
  effectiveHumanity: 70,
  humanitySpent: 5,
  statBonus: { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 },
  hpBonus: 2,
  gigSuccessBonus: 5,
  nilMaxBonus: 0,
};

// Issue #10 — tab catálogo virou tab "Corpo" (body-map + painel de cirurgia);
// a tab "Meu Cromo" (instalados + uninstall) segue intacta (#13).

describe("ChromeView", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
  });

  it("should show a loading state while the catalog is being fetched", () => {
    mocks.api.get.mockImplementation(() => new Promise(() => {}));

    render(<ChromeView />);

    // Body map panel and surgery panel both start loading.
    expect(screen.getAllByText("▌ loading...").length).toBeGreaterThan(0);
  });

  it("should render the body map + surgery panel on Corpo and keep Meu Cromo intact", async () => {
    mockApi();

    render(<ChromeView />);

    // Corpo tab (default): body map + idle surgery panel; the installed
    // implant is announced on the slot label itself (the #188 legenda was
    // deleted — occupancy lives in the label's aria + status text).
    expect(await screen.findByRole("group", { name: "Mapa corporal de cromo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sistema Nervoso: 1/3 ocupados" })).toBeInTheDocument();
    expect(screen.getByText(/Sistema Nervoso/)).toBeInTheDocument();
    expect(screen.getByText(/Selecione um slot no mapa corporal/)).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("tab", { name: "Meu Cromo" }));

    expect(await screen.findByText("70")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument();
    expect(mocks.api.get).toHaveBeenCalledWith("/api/chrome");
    expect(mocks.api.get).toHaveBeenCalledWith("/api/chrome/installed");
  });

  it("should show an error state when the catalog fetch fails", async () => {
    mocks.api.get.mockRejectedValue(new Error("Falha ao carregar catálogo"));

    render(<ChromeView />);

    expect(await screen.findAllByText("Falha ao carregar catálogo")).not.toHaveLength(0);
  });

  it("should surface the installed error on Corpo with a retry instead of hanging in loading", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/chrome") return Promise.resolve([implant, implant2]);
      if (url === "/api/chrome/installed") return Promise.reject(new Error("Falha ao carregar cromo instalado"));
      if (url === "/api/vendors") return Promise.resolve([{ id: "v1", type: "RIPPERDOC" }]);
      if (url === "/api/vendors/v1") return Promise.resolve(RIPPER_DETAIL);
      return Promise.resolve([]);
    });
    const user = userEvent.setup();

    render(<ChromeView />);

    // Error banner with retry — the body map grid never renders.
    expect(await screen.findByText("Não foi possível carregar seu cromo. Tente novamente.")).toBeInTheDocument();
    expect(screen.queryByText("▌ loading...")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Mapa corporal de cromo" })).not.toBeInTheDocument();

    // Retry re-fetches the loadout and the grid recovers.
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/chrome") return Promise.resolve([implant, implant2]);
      if (url === "/api/chrome/installed") return Promise.resolve(installed);
      if (url === "/api/vendors") return Promise.resolve([{ id: "v1", type: "RIPPERDOC" }]);
      if (url === "/api/vendors/v1") return Promise.resolve(RIPPER_DETAIL);
      return Promise.resolve([]);
    });

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("group", { name: "Mapa corporal de cromo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sistema Nervoso: 1/3 ocupados" })).toBeInTheDocument();
  });

  it("should NOT uninstall on the first click — 2-step confirmation arms first", async () => {
    mockApi();
    const user = userEvent.setup();

    render(<ChromeView />);

    await user.click(await screen.findByRole("tab", { name: "Meu Cromo" }));
    await user.click(await screen.findByRole("button", { name: "Remover" }));

    // Arming only — API untouched, button now asks for confirmation.
    expect(await screen.findByRole("button", { name: "CONFIRMAR REMOÇÃO?" })).toBeInTheDocument();
    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it("should uninstall on the second click and surface errors", async () => {
    mockApi();
    mocks.api.post.mockRejectedValue(new Error("Falha ao remover"));
    const user = userEvent.setup();

    render(<ChromeView />);

    await user.click(await screen.findByRole("tab", { name: "Meu Cromo" }));
    await user.click(await screen.findByRole("button", { name: "Remover" }));
    await user.click(await screen.findByRole("button", { name: "CONFIRMAR REMOÇÃO?" }));

    expect(await screen.findByText("Falha ao remover")).toBeInTheDocument();
    expect(mocks.api.post).toHaveBeenCalledWith("/api/chrome/uninstall", {
      installedChromeId: "i1",
    });
  });

  it("should call the API on the second click and reset the confirmation after success", async () => {
    mockApi();
    mocks.api.post.mockResolvedValue({});
    const user = userEvent.setup();

    render(<ChromeView />);

    await user.click(await screen.findByRole("tab", { name: "Meu Cromo" }));
    await user.click(await screen.findByRole("button", { name: "Remover" }));
    await user.click(await screen.findByRole("button", { name: "CONFIRMAR REMOÇÃO?" }));

    expect(await screen.findByText("Implante removido.")).toBeInTheDocument();
    expect(mocks.api.post).toHaveBeenCalledWith("/api/chrome/uninstall", {
      installedChromeId: "i1",
    });
    // Confirmation reset — button is back to the idle "Remover" label.
    expect(await screen.findByRole("button", { name: "Remover" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CONFIRMAR REMOÇÃO?" })).not.toBeInTheDocument();
  });

  it("should reset mounted ref after StrictMode remount and show empty state", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/chrome") return Promise.resolve([]);
      if (url === "/api/vendors") return Promise.resolve([{ id: "v1", type: "RIPPERDOC" }]);
      if (url === "/api/chrome/installed") return Promise.resolve({
        installed: [],
        effectiveHumanity: 75,
        humanitySpent: 0,
        statBonus: { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 },
        hpBonus: 0,
        gigSuccessBonus: 0,
        nilMaxBonus: 0,
      });
      return Promise.resolve([]);
    });

    render(<StrictMode><ChromeView /></StrictMode>);

    // Empty state only appears after loading resolves — proves StrictMode remount didn't break mountedRef
    expect(await screen.findByText("Nenhum implante disponível.")).toBeInTheDocument();
    expect(screen.queryByText("▌ loading...")).not.toBeInTheDocument();
  });

  it("should pass the ferrageiro stock prices to the surgery panel (no basePrice drift)", async () => {
    mockApi();
    const user = userEvent.setup();

    render(<ChromeView />);

    // Seleciona o slot e abre o implante não instalado.
    await user.click(await screen.findByRole("button", { name: /^Sistema Nervoso: / }));
    await user.click(await screen.findByRole("button", { name: /Mira de Plasma/ }));

    // O review mostra o preço do estoque do ferrageiro (G$ 900), não o
    // basePrice do catálogo (G$ 300).
    expect(await screen.findByText("Custo: G$ 900")).toBeInTheDocument();
    expect(mocks.api.get).toHaveBeenCalledWith("/api/vendors/v1");
  });

  it("should close the picker modal on Escape and restore the idle hint (onClose clears the slot)", async () => {
    mockApi();
    const user = userEvent.setup();

    render(<ChromeView />);

    // Open the picker from a slot label (emenda 1 §E1.1).
    await user.click(await screen.findByRole("button", { name: /^Sistema Nervoso: / }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Esc closes the modal; onClose clears selectedSlot → the panel remounts
    // with slot=null and the idle hint returns (E1.7).
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/Selecione um slot no mapa corporal/)).toBeInTheDocument();
  });
});
