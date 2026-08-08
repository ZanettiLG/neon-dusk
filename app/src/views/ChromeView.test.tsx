import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChromeView from "@/views/ChromeView";
import type { ChromeDefinition, InstalledChromeResponse } from "@neon-dusk/shared";

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

describe("ChromeView", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
  });

  it("should show a loading state while the catalog is being fetched", () => {
    mocks.api.get.mockImplementation(() => new Promise(() => {}));

    render(<ChromeView />);

    // Catalog and installed panels both start loading.
    expect(screen.getAllByText("▌ loading...").length).toBeGreaterThan(0);
  });

  it("should render the catalog and the installed tab content", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/chrome") return Promise.resolve([implant]);
      if (url === "/api/chrome/installed") return Promise.resolve(installed);
      return Promise.resolve([]);
    });

    render(<ChromeView />);

    expect(await screen.findByText("Smart Link")).toBeInTheDocument();
    expect(screen.getByText(/Sistema Nervoso/)).toBeInTheDocument();
    expect(screen.getByText("500 eds")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Instalar" })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Meu Chrome" }));

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

  it("should surface install error from the API", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/chrome") return Promise.resolve([implant]);
      if (url === "/api/chrome/installed") return Promise.resolve(installed);
      return Promise.resolve([]);
    });
    mocks.api.post.mockRejectedValue(new Error("Eds insuficientes."));
    const user = userEvent.setup();

    render(<ChromeView />);

    await user.click(await screen.findByRole("button", { name: "Instalar" }));

    expect(await screen.findByText("Eds insuficientes.")).toBeInTheDocument();
    expect(mocks.api.post).toHaveBeenCalledWith("/api/chrome/install", {
      chromeId: "ch1",
    });
  });
});
