import { create } from "zustand";
import { api, ApiError } from "@/api/client";
import type { ConsumableUseResponse, ConsumablesResponse } from "@neon-dusk/shared";
import { useHudStore } from "@/stores/hud";
import { useHumanityStore } from "@/stores/humanity";

/** Structured use-action error surfaced to the panel. */
export interface ConsumableUseError {
  /** Server error code (e.g. COOLDOWN_ACTIVE, BAND_TOO_HIGH). */
  code: string;
  /** PT-BR message (already translated by the api client via ptBrError). */
  message: string;
  /** ISO — when the item becomes usable again (COOLDOWN_ACTIVE only). */
  nextAvailableAt: string | null;
}

interface ConsumablesState {
  /** Catalog + stock readout (null while unloaded or after a failed fetch). */
  items: ConsumablesResponse["items"] | null;
  loading: boolean;
  /** GET /api/consumables error (null while idle or after a success). */
  error: string | null;
  /** Item with a use POST in flight (null when idle). */
  usingItemId: string | null;
  /** Structured error of the last use attempt (null after a success). */
  useError: ConsumableUseError | null;
  /** Result of the last successful use (null until the first use). */
  lastUse: ConsumableUseResponse | null;

  /** GET /api/consumables — catalog + owned stock + per-item cooldowns. */
  fetch: () => Promise<void>;
  /** POST /api/consumables/use — consume one owned item. Re-throws on failure. */
  useItem: (itemId: string) => Promise<ConsumableUseResponse>;
}

/** Pull the unlock time out of a COOLDOWN_ACTIVE ApiError (details.nextAvailableAt). */
function extractNextAvailableAt(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const details = err.details as { nextAvailableAt?: unknown } | null | undefined;
  return typeof details?.nextAvailableAt === "string" ? details.nextAvailableAt : null;
}

/**
 * Consumables store (Zustand singleton) — itens anti-insanidade (issue #28,
 * UI issue #48): catalog readout + the use action that restores humanity.
 * Import direction is one-way: this store pulls useHudStore/useHumanityStore
 * via getState() (never the other way around) so the HUD bar and the humanity
 * readout stay fresh after every successful use. Ephemeral — no persist.
 */
export const useConsumablesStore = create<ConsumablesState>((set, get) => ({
  items: null,
  loading: false,
  error: null,
  usingItemId: null,
  useError: null,
  lastUse: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get<ConsumablesResponse>("/api/consumables");
      set({ items: res.items, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Falha ao carregar consumíveis",
        loading: false,
      });
    }
  },

  useItem: async (itemId) => {
    set({ usingItemId: itemId, useError: null });
    try {
      const result = await api.post<ConsumableUseResponse>("/api/consumables/use", { itemId });
      // Stock/cooldowns moved — refetch before resolving so items match the server.
      await get().fetch();
      set({ lastUse: result, usingItemId: null });
      // Humanidade mudou — mantém a HUD e o readout de humanidade em dia.
      void useHudStore.getState().refresh();
      void useHumanityStore.getState().fetch();
      return result;
    } catch (err) {
      set({
        useError: {
          code: err instanceof ApiError ? err.code : "UNKNOWN_ERROR",
          message: err instanceof Error ? err.message : "Falha ao usar o item",
          nextAvailableAt: extractNextAvailableAt(err),
        },
        usingItemId: null,
      });
      throw err;
    }
  },
}));
