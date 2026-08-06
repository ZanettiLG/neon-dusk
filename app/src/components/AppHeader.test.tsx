import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppHeader from "@/components/AppHeader";
import { useAppStore } from "@/stores/app";

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

describe("AppHeader", () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState());
    mocks.api.get.mockReset();
  });

  it("should render the brand and version badge", async () => {
    mocks.api.get.mockResolvedValue({
      status: "ok",
      timestamp: "2026-01-01T00:00:00.000Z",
      uptime: 1,
      version: "0.1.0",
      services: { database: "connected", redis: "connected" },
    });

    render(<AppHeader />);

    expect(screen.getByRole("heading", { name: "NEON // DUSK" })).toBeInTheDocument();
    expect(screen.getByText("v0.1.0-alpha")).toBeInTheDocument();

    // StatusBar inside the header polls health on mount.
    expect(await screen.findByText("● online")).toBeInTheDocument();
    expect(mocks.api.get).toHaveBeenCalledWith("/api/health");
  });
});
