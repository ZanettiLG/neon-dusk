import { create } from "zustand";
import { useAuthStore } from "@/stores/auth";
import type { Origin } from "@neon-dusk/shared";

/** Duration of one metro crossing (diegetic heartbeat of the ride). */
export const METRO_TRAVEL_MS = 1800;

// Module-level timer: the store is a singleton and a pending crossing must be
// cancellable when the view unmounts (same pattern as the crew store's
// reconnect timer). The timer never fires off-screen.
let travelTimer: ReturnType<typeof setTimeout> | null = null;

interface MetroState {
  /** District the character currently stands in (null until init runs). */
  currentDistrict: Origin | null;
  /** True while a crossing is in flight (stations disabled, overlay shown). */
  traveling: boolean;
  /**
   * Seed currentDistrict from the auth character's origin — call on view
   * mount. No-op once a district is already set.
   */
  init: () => void;
  /**
   * Start a crossing to `origin`: marks traveling, swaps the district after
   * {@link METRO_TRAVEL_MS}. No-op while traveling or to the same district.
   */
  travelTo: (origin: Origin) => void;
  /** Cancel a pending crossing (view unmount). */
  cancelTravel: () => void;
}

/**
 * Metro store (Zustand singleton) — diegetic travel between the seven
 * districts. No persistence: each visit starts on the character's origin.
 */
export const useMetroStore = create<MetroState>((set, get) => ({
  currentDistrict: null,
  traveling: false,

  init: () => {
    const { currentDistrict, traveling } = get();
    if (currentDistrict !== null || traveling) return;
    set({ currentDistrict: useAuthStore.getState().character?.origin ?? null });
  },

  travelTo: (origin) => {
    const { currentDistrict, traveling } = get();
    if (traveling || origin === currentDistrict) return;
    if (travelTimer) {
      clearTimeout(travelTimer);
      travelTimer = null;
    }
    set({ traveling: true });
    travelTimer = setTimeout(() => {
      travelTimer = null;
      set({ currentDistrict: origin, traveling: false });
    }, METRO_TRAVEL_MS);
  },

  cancelTravel: () => {
    if (travelTimer) {
      clearTimeout(travelTimer);
      travelTimer = null;
    }
    set({ traveling: false });
  },
}));
