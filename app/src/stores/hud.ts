import { create } from "zustand";
import { api } from "@/api/client";
import type { EconomyBalanceResponse, InstalledChromeResponse, OsStatus } from "@neon-dusk/shared";

interface HudState {
  /** Wallet balance (G$). Null while unloaded or after a failed refresh. */
  balance: number | null;
  balanceError: string | null;
  /** Grana committed to pending deals (unspendable). Null while unloaded. */
  escrow: number | null;
  /** Effective humanity after installed cromo (0–100). Null while unloaded. */
  humanity: number | null;
  humanityError: string | null;
  /** Installed OS readout (issue #28). Null while unloaded/no OS. */
  os: OsStatus | null;

  /** Fetch balance + humanity + OS status in parallel (best-effort, never throws). */
  refresh: () => Promise<void>;
}

/** Read a number field from an unknown payload (defensive against mocks). */
function numField(value: unknown, key: string): number | null {
  if (value === null || value === undefined) return null;
  const v = (value as Record<string, unknown>)[key];
  return typeof v === "number" ? v : null;
}

/**
 * HUD store (Zustand singleton) — the persistent character readouts shown in
 * the app shell (issue #13). Ephemeral: refreshed on shell mount and after
 * every action that moves grana or humanity (wrap-up, PvP, vendor, cromo,
 * terapia, consumíveis, OS — issue #28). Does not import other stores so
 * callers can always `getState().refresh()` without circular-import risk.
 *
 * Humanity comes from GET /api/humanity (band-aware, scrubber regen applied);
 * the cromo/installed readout remains as a fallback for resilience.
 */
export const useHudStore = create<HudState>((set) => ({
  balance: null,
  balanceError: null,
  escrow: null,
  humanity: null,
  humanityError: null,
  os: null,

  refresh: async () => {
    const [balanceRes, humanityRes, osRes, chromeRes] = await Promise.allSettled([
      api.get<EconomyBalanceResponse>("/api/economy/balance"),
      api.get<{ humanity?: number }>("/api/humanity"),
      api.get<OsStatus>("/api/os/status"),
      api.get<InstalledChromeResponse>("/api/chrome/installed"),
    ]);

    const humanityInfo =
      humanityRes.status === "fulfilled" ? numField(humanityRes.value, "humanity") : null;
    const chromeHumanity =
      chromeRes.status === "fulfilled" ? numField(chromeRes.value, "effectiveHumanity") : null;
    const humanity = humanityInfo ?? chromeHumanity;

    set({
      balance: balanceRes.status === "fulfilled" ? numField(balanceRes.value, "balance") : null,
      balanceError:
        balanceRes.status === "rejected"
          ? balanceRes.reason instanceof Error
            ? balanceRes.reason.message
            : "Falha ao carregar grana"
          : null,
      escrow: balanceRes.status === "fulfilled" ? numField(balanceRes.value, "escrow") : null,
      humanity,
      humanityError:
        humanity === null
          ? humanityRes.status === "rejected"
            ? humanityRes.reason instanceof Error
              ? humanityRes.reason.message
              : "Falha ao carregar humanidade"
            : chromeRes.status === "rejected"
              ? chromeRes.reason instanceof Error
                ? chromeRes.reason.message
                : "Falha ao carregar humanidade"
              : null
          : null,
      os: osRes.status === "fulfilled" && osRes.value ? osRes.value : null,
    });
  },
}));
