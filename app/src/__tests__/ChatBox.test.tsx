import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { create } from "zustand";
import ChatBox from "@/components/ChatBox";
import type { ChatMessage } from "@neon-dusk/shared";

// Controllable Zustand mocks (same pattern as SaideiraView.test.tsx)
const saideiraMocks = vi.hoisted(() => ({
  messages: [] as ChatMessage[],
  chatStatus: "connected" as const,
  chatSendLoading: false,
  chatSendError: null as string | null,
  sendMessage: vi.fn(),
}));

vi.mock("@/stores/saideira", () => ({
  useSaideiraStore: create(() => ({ ...saideiraMocks })),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: create(() => ({ character: { name: "Ghost" }, accessToken: "tok" })),
}));

const { useSaideiraStore } = await import("@/stores/saideira");

describe("ChatBox", () => {
  beforeEach(() => {
    useSaideiraStore.setState({ ...saideiraMocks });
  });

  it("renders without error (baseline)", () => {
    render(<ChatBox />);
    expect(screen.getByText("CIDADE // CHAT")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Diz aí, runner...")).toBeInTheDocument();
  });

  it("shows connected indicator (green) when chatStatus is connected", () => {
    useSaideiraStore.setState({ chatStatus: "connected" });
    render(<ChatBox />);
    expect(screen.getByText("▲ ao vivo")).toBeInTheDocument();
  });

  it("shows reconnecting indicator (yellow) when chatStatus is reconnecting", () => {
    useSaideiraStore.setState({ chatStatus: "reconnecting" });
    render(<ChatBox />);
    expect(screen.getByText("▼ reconectando...")).toBeInTheDocument();
  });

  it("shows offline indicator (red) and banner when chatStatus is offline", () => {
    useSaideiraStore.setState({ chatStatus: "offline" });
    render(<ChatBox />);
    expect(screen.getByText("✕ offline")).toBeInTheDocument();
    expect(screen.getByText("Chat indisponível. Tentando reconectar...")).toBeInTheDocument();
  });

  it("does not show offline banner when connected or reconnecting", () => {
    useSaideiraStore.setState({ chatStatus: "connected" });
    const { unmount } = render(<ChatBox />);
    expect(screen.queryByText("Chat indisponível. Tentando reconectar...")).not.toBeInTheDocument();
    unmount();

    useSaideiraStore.setState({ chatStatus: "reconnecting" });
    render(<ChatBox />);
    expect(screen.queryByText("Chat indisponível. Tentando reconectar...")).not.toBeInTheDocument();
  });

  it("renders messages with character names and crew tags", () => {
    useSaideiraStore.setState({
      chatStatus: "connected",
      messages: [
        {
          id: "m1",
          characterName: "Raven",
          crewTag: "Crows",
          message: "Hey mano.",
          createdAt: "2085-01-01T00:00:00.000Z",
        },
      ],
    });
    render(<ChatBox />);
    expect(screen.getByText("Raven")).toBeInTheDocument();
    expect(screen.getByText((c) => c.includes("Crows"))).toBeInTheDocument();
    expect(screen.getByText("Hey mano.")).toBeInTheDocument();
  });
});
