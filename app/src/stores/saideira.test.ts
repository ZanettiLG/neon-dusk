import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSaideiraStore } from "@/stores/saideira";

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
  API_BASE_URL: "",
  ApiError: class extends Error {
    status: number;
    code: string;
    details: unknown;
    constructor(status: number, code: string, message: string, details?: unknown) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  },
}));

describe("useSaideiraStore.sendMessage", () => {
  beforeEach(() => {
    useSaideiraStore.setState(useSaideiraStore.getInitialState());
    mocks.api.post.mockReset();
  });

  it("should set chatBlock with code/retryAfterSeconds/endsAt on 429 and NOT set chatSendError", async () => {
    const { ApiError } = await import("@/api/client");
    mocks.api.post.mockRejectedValue(
      new ApiError(429, "COOLDOWN_ACTIVE", "Ação em cooldown. Aguarde.", { retryAfter: 30 }),
    );

    await expect(useSaideiraStore.getState().sendMessage("oi")).rejects.toThrow();

    const s = useSaideiraStore.getState();
    expect(s.chatBlock).not.toBeNull();
    expect(s.chatBlock?.code).toBe("COOLDOWN_ACTIVE");
    expect(s.chatBlock?.retryAfterSeconds).toBe(30);
    expect(s.chatBlock?.endsAt).toBeGreaterThan(Date.now());
    expect(s.chatBlock?.endsAt).toBeLessThanOrEqual(Date.now() + 30_000);
    expect(s.chatSendError).toBeNull();
    expect(s.chatSendLoading).toBe(false);
    expect(mocks.api.post).toHaveBeenCalledWith("/api/saideira/chat", { message: "oi" });
  });

  it("should default retryAfterSeconds to 60 when the 429 carries no details", async () => {
    const { ApiError } = await import("@/api/client");
    mocks.api.post.mockRejectedValue(new ApiError(429, "RATE_LIMITED", "Muitas requisições. Aguarde."));

    await expect(useSaideiraStore.getState().sendMessage("oi")).rejects.toThrow();

    const s = useSaideiraStore.getState();
    expect(s.chatBlock?.code).toBe("RATE_LIMITED");
    expect(s.chatBlock?.retryAfterSeconds).toBe(60);
    expect(s.chatSendError).toBeNull();
  });

  it("should set chatSendError on non-429 API errors and NOT set chatBlock", async () => {
    const { ApiError } = await import("@/api/client");
    mocks.api.post.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "Erro interno. Tente novamente."));

    await expect(useSaideiraStore.getState().sendMessage("oi")).rejects.toThrow();

    const s = useSaideiraStore.getState();
    expect(s.chatSendError).toBe("Erro interno. Tente novamente.");
    expect(s.chatBlock).toBeNull();
  });

  it("should set chatSendError on generic errors and NOT set chatBlock", async () => {
    mocks.api.post.mockRejectedValue(new Error("network down"));

    await expect(useSaideiraStore.getState().sendMessage("oi")).rejects.toThrow();

    const s = useSaideiraStore.getState();
    expect(s.chatSendError).toBe("network down");
    expect(s.chatBlock).toBeNull();
  });

  it("should clear an active chatBlock via clearChatBlock", () => {
    useSaideiraStore.setState({
      chatBlock: { code: "COOLDOWN_ACTIVE", retryAfterSeconds: 60, endsAt: Date.now() + 60_000 },
    });
    expect(useSaideiraStore.getState().chatBlock).not.toBeNull();

    useSaideiraStore.getState().clearChatBlock();

    expect(useSaideiraStore.getState().chatBlock).toBeNull();
  });
});