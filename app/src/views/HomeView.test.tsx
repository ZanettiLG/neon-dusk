import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import HomeView from "@/views/HomeView";
import { useAppStore } from "@/stores/app";
import type { HealthResponse } from "@neon-dusk/shared";

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

const health: HealthResponse = {
  status: "ok",
  timestamp: "2026-01-01T00:00:00.000Z",
  uptime: 42,
  version: "0.1.0",
  services: { database: "connected", redis: "connected" },
};

describe("HomeView", () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState());
    mocks.api.get.mockReset();
  });

  it("should render the hero text and the system status card", async () => {
    mocks.api.get.mockResolvedValue(health);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HomeView />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "NEON // DUSK" })).toBeInTheDocument();
    expect(
      screen.getByText("Build your chrome. Burn your name. Leave a legend."),
    ).toBeInTheDocument();

    expect(screen.getByText("System Status")).toBeInTheDocument();
    expect(await screen.findByText("● ONLINE")).toBeInTheDocument();
    expect(screen.getAllByText("connected")).toHaveLength(2);
    expect(screen.getByText("42s")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    expect(mocks.api.get).toHaveBeenCalledWith("/api/health");
  });

  it("should show the error and retry when the health check fails", async () => {
    mocks.api.get.mockRejectedValueOnce(new Error("API down")).mockResolvedValue(health);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HomeView />
      </MemoryRouter>,
    );

    expect(await screen.findByText("API down")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("● ONLINE")).toBeInTheDocument();
  });
});
