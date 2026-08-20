import { create } from "zustand";
import { api } from "@/api/client";
import type { EconomyBalanceResponse, InstalledChromeResponse } from "@neon-dusk/shared";

interface HudState {
  /** Wallet balance (G$). Null while unloaded or after a failed refresh. */
  balance: number | null;
  balanceError: string | null;
  /** Effective humanity after installed cromo (0–100). Null while unloaded. */
  humanity: number | null;
  humanityError: string | null;

  /** Fetch balance + humanity in parallel (best-effort, never throws). */
  refresh: () => Promise<void>;
}

/**
 * HUD store (Zustand singleton) — the persistent character readouts shown in
 * the app shell (issue #13). Ephemeral: refreshed on shell mount and after
 * every action that moves grana or humanity (wrap-up, PvP, vendor, cromo).
 * Does not import other stores so callers can always `getState().refresh()`
 * without circular-import risk.
 */
export const useHudStore = create<HudState>((set) => ({
  balance: null,
  balanceError: null,
  humanity: null,
  humanityError: null,

  refresh: async () => {
    const [balanceRes, chromeRes] = await Promise.allSettled([
      api.get<EconomyBalanceResponse>("/api/economy/balance"),
      api.get<InstalledChromeResponse>("/api/chrome/installed"),
    ]);
    set({
      balance: balanceRes.status === "fulfilled" ? balanceRes.value.balance : null,
      balanceError:
        balanceRes.status === "rejected"
          ? balanceRes.reason instanceof Error
            ? balanceRes.reason.message
            : "Falha ao carregar grana"
          : null,
      humanity:
        chromeRes.status === "fulfilled" ? chromeRes.value.effectiveHumanity : null,
      humanityError:
        chromeRes.status === "rejected"
          ? chromeRes.reason instanceof Error
            ? chromeRes.reason.message
            : "Falha ao carregar humanidade"
          : null,
    });
  },
}));
