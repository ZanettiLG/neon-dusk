import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { create } from "zustand";
import ChatBox from "@/components/ChatBox";
import type { ChatMessage } from "@neon-dusk/shared";

// Controllable Zustand mocks (same pattern as SaideiraView.test.tsx)
const saideiraMocks = vi.hoisted(() => ({
  messages: [] as ChatMessage[],
  chatStatus: "connected" as const,
  chatSendLoading: false,
  chatSendError: null as string | null,
  chatBlock: null as {
    code: "COOLDOWN_ACTIVE" | "RATE_LIMITED" | "CIRCUIT_BREAK";
    retryAfterSeconds: number;
    endsAt: number;
  } | null,
  clearChatBlock: vi.fn(),
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
    expect(screen.getByPlaceholderText("Diz aí, corredor...")).toBeInTheDocument();
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

  it("shows a gold block banner and disables send while a chat block is active", () => {
    useSaideiraStore.setState({
      chatStatus: "connected",
      chatBlock: {
        code: "COOLDOWN_ACTIVE",
        retryAfterSeconds: 60,
        endsAt: Date.now() + 60_000,
      },
      messages: [],
    });
    render(<ChatBox />);
    expect(screen.getByText("O balcão tá fervendo. Respira — 60s.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ENVIAR" })).toBeDisabled();
    // Input stays enabled — only the send button is blocked.
    expect(screen.getByPlaceholderText("Diz aí, corredor...")).toBeEnabled();
  });

  it("shows the RATE_LIMITED copy with the countdown interpolated", () => {
    useSaideiraStore.setState({
      chatStatus: "connected",
      chatBlock: {
        code: "RATE_LIMITED",
        retryAfterSeconds: 30,
        endsAt: Date.now() + 30_000,
      },
      messages: [],
    });
    render(<ChatBox />);
    expect(screen.getByText("Cê tá falando rápido demais, corredor. 30s.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ENVIAR" })).toBeDisabled();
  });

  it("shows the static CIRCUIT_BREAK copy without a countdown", () => {
    useSaideiraStore.setState({
      chatStatus: "connected",
      chatBlock: {
        code: "CIRCUIT_BREAK",
        retryAfterSeconds: 86_400,
        endsAt: Date.now() + 86_400_000,
      },
      messages: [],
    });
    render(<ChatBox />);
    expect(screen.getByText("Sistema neural sobrecarregado. Volta em 24h.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ENVIAR" })).toBeDisabled();
  });

  it("decrements the block countdown and clears the block when it reaches zero", () => {
    vi.useFakeTimers();
    try {
      saideiraMocks.clearChatBlock.mockClear();
      useSaideiraStore.setState({
        chatStatus: "connected",
        chatBlock: {
          code: "COOLDOWN_ACTIVE",
          retryAfterSeconds: 60,
          endsAt: Date.now() + 60_000,
        },
        messages: [],
      });
      render(<ChatBox />);
      expect(screen.getByText("O balcão tá fervendo. Respira — 60s.")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText("O balcão tá fervendo. Respira — 59s.")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(59_000);
      });
      expect(saideiraMocks.clearChatBlock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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
