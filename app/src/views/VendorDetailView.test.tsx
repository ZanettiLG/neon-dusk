import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VendorDetailView from "@/views/VendorDetailView";
import type { VendorWithInventory } from "@neon-dusk/shared";

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

const detail: VendorWithInventory = {
  vendor: {
    id: "v1",
    name: "Ferrageiro Zé",
    type: "RIPPERDOC",
    district: "A Paraíso",
  },
  inventory: [
    { id: "inv1", vendorId: "v1", itemType: "CONSUMABLE", itemId: "syn-cafe", price: 50, stock: -1 },
    {
      id: "inv2",
      vendorId: "v1",
      itemType: "CHROME",
      itemId: "gorilla-arms",
      price: 5000,
      stock: 3,
      chromeDefinitionId: "cd-gorilla",
      chromeDefinitionName: "Braço de Ferro",
      humanityCost: 8,
    },
  ],
};

function renderView() {
  return render(
    <MemoryRouter initialEntries={["/vendors/v1"]}>
      <Routes>
        <Route path="/vendors/:id" element={<VendorDetailView />} />
        <Route path="/vendors" element={<div>VENDORS PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("VendorDetailView", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
  });

  it("should show a loading state while the vendor is being fetched", () => {
    mocks.api.get.mockImplementation(() => new Promise(() => {}));

    renderView();

    expect(screen.getByText("▌ loading...")).toBeInTheDocument();
    expect(mocks.api.get).toHaveBeenCalledWith("/api/vendors/v1");
  });

  it("should render the vendor header and inventory", async () => {
    mocks.api.get.mockResolvedValue(detail);

    renderView();

    expect(await screen.findByText("Ferrageiro Zé")).toBeInTheDocument();
    expect(screen.getByText("Ferrageiro")).toBeInTheDocument();
    expect(screen.getByText("G$ 5000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comprar & Instalar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restaurar NIL (+20)" })).toBeInTheDocument();
  });

  it("should render display names instead of raw internal ids", async () => {
    mocks.api.get.mockResolvedValue(detail);

    renderView();

    expect(await screen.findByText("Braço de Ferro")).toBeInTheDocument();
    expect(screen.getByText("Pingado")).toBeInTheDocument();
    // Item type labels follow the terminology (chrome → cromo, stim → ampola)
    expect(screen.getByText("Cromo")).toBeInTheDocument();
    expect(screen.getByText("Ampola")).toBeInTheDocument();
    // Raw slugs never leak to the UI
    expect(screen.queryByText("gorilla-arms")).toBeNull();
    expect(screen.queryByText("syn-cafe")).toBeNull();
  });

  it("should fall back to a dash when an item has no display name", async () => {
    mocks.api.get.mockResolvedValue({
      ...detail,
      inventory: [
        { id: "inv3", vendorId: "v1", itemType: "LOOT", itemId: "unknown-item", price: 100, stock: 1 },
      ],
    });

    renderView();

    // Two dashes: one for the item name, one for the humanity column
    expect(await screen.findAllByText("—")).toHaveLength(2);
    expect(screen.queryByText("unknown-item")).toBeNull();
  });

  it("should buy an item and show the success message", async () => {
    mocks.api.get.mockResolvedValue(detail);
    mocks.api.post.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderView();

    await user.click(await screen.findByRole("button", { name: "Restaurar NIL (+20)" }));

    expect(await screen.findByText("Compra realizada!")).toBeInTheDocument();
    expect(mocks.api.post).toHaveBeenCalledWith("/api/vendors/v1/buy", {
      itemType: "CONSUMABLE",
      itemId: "syn-cafe",
      quantity: 1,
    });
  });

  it("should show an error state when the fetch fails", async () => {
    mocks.api.get.mockRejectedValue(new Error("Falha ao carregar vendedor"));

    renderView();

    expect(await screen.findByText("Falha ao carregar vendedor")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Voltar" })).toHaveAttribute("href", "/vendors");
  });

  it("should surface buy error from the API", async () => {
    mocks.api.get.mockResolvedValue(detail);
    mocks.api.post.mockRejectedValue(new Error("Grana insuficiente."));
    const user = userEvent.setup();

    renderView();

    await user.click(await screen.findByRole("button", { name: "Restaurar NIL (+20)" }));

    expect(await screen.findByText("Grana insuficiente.")).toBeInTheDocument();
    expect(mocks.api.post).toHaveBeenCalledWith("/api/vendors/v1/buy", {
      itemType: "CONSUMABLE",
      itemId: "syn-cafe",
      quantity: 1,
    });
  });
});
