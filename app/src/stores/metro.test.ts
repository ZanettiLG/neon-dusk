import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useMetroStore, METRO_TRAVEL_MS } from "@/stores/metro";
import { useAuthStore } from "@/stores/auth";
import type { Character } from "@neon-dusk/shared";

// Mock the api client module (frontier) so the transitively-imported auth
// store never touches fetch.
const mocks = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
    }
  }
  return {
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    setAccessToken: vi.fn(),
    ApiError,
  };
});

vi.mock("@/api/client", () => ({
  api: mocks.api,
  setAccessToken: mocks.setAccessToken,
  ApiError: mocks.ApiError,
  API_BASE_URL: "",
}));

const character: Character = {
  id: "c1",
  userId: "u1",
  name: "Ghost",
  origin: "a_paraiso",
  role: "bicho",
  body: 3,
  reflexes: 3,
  intelligence: 3,
  technical: 3,
  cool: 3,
  streetCred: 0,
  maxStreetCredAchieved: 0,
  ability: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("useMetroStore", () => {
  beforeEach(() => {
    // The module-level crossing timer is NOT part of the zustand state —
    // tear it down first, then reset both stores.
    useMetroStore.getState().cancelTravel();
    useMetroStore.setState(useMetroStore.getInitialState());
    useAuthStore.setState(useAuthStore.getInitialState());
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("init", () => {
    it("should default currentDistrict to the character origin", () => {
      useAuthStore.setState({ character });

      useMetroStore.getState().init();

      expect(useMetroStore.getState().currentDistrict).toBe("a_paraiso");
    });

    it("should keep currentDistrict null on init without a character", () => {
      useMetroStore.getState().init();

      expect(useMetroStore.getState().currentDistrict).toBeNull();
    });

    it("should not overwrite a district that is already set", () => {
      useAuthStore.setState({ character });
      useMetroStore.setState({ currentDistrict: "babilonia" });

      useMetroStore.getState().init();

      expect(useMetroStore.getState().currentDistrict).toBe("babilonia");
    });
  });

  describe("travelTo", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      useAuthStore.setState({ character });
      useMetroStore.getState().init();
    });

    it("should mark traveling and swap the district after the crossing delay", () => {
      useMetroStore.getState().travelTo("o_ponto");

      const during = useMetroStore.getState();
      expect(during.traveling).toBe(true);
      expect(during.currentDistrict).toBe("a_paraiso");

      vi.advanceTimersByTime(METRO_TRAVEL_MS);

      const after = useMetroStore.getState();
      expect(after.traveling).toBe(false);
      expect(after.currentDistrict).toBe("o_ponto");
    });

    it("should not complete the crossing before the delay elapses", () => {
      useMetroStore.getState().travelTo("o_ponto");

      vi.advanceTimersByTime(METRO_TRAVEL_MS - 1);

      expect(useMetroStore.getState().traveling).toBe(true);
      expect(useMetroStore.getState().currentDistrict).toBe("a_paraiso");
    });

    it("should clear a pending timer on cancelTravel (view unmount)", () => {
      useMetroStore.getState().travelTo("o_ponto");
      useMetroStore.getState().cancelTravel();

      vi.advanceTimersByTime(METRO_TRAVEL_MS);

      const s = useMetroStore.getState();
      expect(s.traveling).toBe(false);
      expect(s.currentDistrict).toBe("a_paraiso");
    });

    it("should be a no-op when traveling to the current district", () => {
      useMetroStore.getState().travelTo("a_paraiso");

      expect(useMetroStore.getState().traveling).toBe(false);
    });

    it("should ignore a second travelTo while traveling (keep the first destination)", () => {
      useMetroStore.getState().travelTo("o_ponto");
      useMetroStore.getState().travelTo("babilonia");

      expect(useMetroStore.getState().traveling).toBe(true);

      // The original timer must survive — the ride lands on the FIRST pick.
      vi.advanceTimersByTime(METRO_TRAVEL_MS);

      const s = useMetroStore.getState();
      expect(s.traveling).toBe(false);
      expect(s.currentDistrict).toBe("o_ponto");
    });
  });
});
