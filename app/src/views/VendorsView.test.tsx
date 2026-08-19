import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VendorsView from "@/views/VendorsView";
import type { VendorRecord } from "@neon-dusk/shared";

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

const vendor: VendorRecord = {
  id: "v1",
  name: "Ferrageiro Zé",
  type: "RIPPERDOC",
  district: "A Paraíso",
  description: "Chips e mais chips.",
};

function renderView() {
  return render(
    <MemoryRouter initialEntries={["/vendors"]}>
      <Routes>
        <Route path="/vendors" element={<VendorsView />} />
        <Route path="/vendors/:id" element={<div>VENDOR DETAIL PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("VendorsView", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
  });

  it("should show a loading state while vendors are being fetched", () => {
    mocks.api.get.mockImplementation(() => new Promise(() => {}));

    renderView();

    expect(screen.getByText("▌ loading...")).toBeInTheDocument();
  });

  it("should render the vendor directory", async () => {
    mocks.api.get.mockResolvedValue([vendor]);

    renderView();

    expect(await screen.findByText("Ferrageiro Zé")).toBeInTheDocument();
    expect(screen.getByText("A Paraíso")).toBeInTheDocument();
    expect(mocks.api.get).toHaveBeenCalledWith("/api/vendors");
  });

  it("should navigate to the vendor detail page when a vendor is clicked", async () => {
    mocks.api.get.mockResolvedValue([vendor]);
    const user = userEvent.setup();

    renderView();

    await user.click(await screen.findByRole("button", { name: /Ferrageiro Zé/ }));

    expect(screen.getByText("VENDOR DETAIL PAGE")).toBeInTheDocument();
  });

  it("should show an error state when the fetch fails", async () => {
    mocks.api.get.mockRejectedValue(new Error("Falha ao carregar vendedores"));

    renderView();

    expect(await screen.findByText("Falha ao carregar vendedores")).toBeInTheDocument();
  });
});
