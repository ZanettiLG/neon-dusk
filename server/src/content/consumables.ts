// Neon Dusk — Itens anti-insanidade catalog seed (issue #28, design delta)
// ============================================================================
// 3 sanity-restoring consumables. Prices live in vendor_inventory (ADR 28-C);
// `basePrice` here is informational only (balance anchor documentation).
//
// Balance (delta): clinic anchor = 1.000 G$/pt → items priced at 1.5-2.0×:
//   Estabilizador 7.500/5 = 1.500 G$/pt · Freio 18.000/10 = 1.800 ·
//   Choque 30.000/15 = 2.000. G$ sinks with an anti-farm ceiling of 3 uses/24h
//   (diminishing returns 100/60/30%, 4th use blocked — ADR 28-B).
//
// #187: per-item cooldowns removed — the stock (purchased inventory) and the
// rolling-24h use window are the limiters now. cooldown_hours stays in the
// schema (0 = none) so the mechanism can be re-enabled via seeds if needed.

export interface ConsumableSeedEntry {
  slug: string;
  name: string;
  tier: number;
  restoreAmount: number;
  /** Per-item cooldown in hours (0 = none; derived from consumable_uses). */
  cooldownHours: number;
  basePrice: number;
  description: string;
}

export const CONSUMABLE_CATALOG: ConsumableSeedEntry[] = [
  {
    slug: "estabilizador",
    name: "Estabilizador",
    tier: 1,
    restoreAmount: 5,
    cooldownHours: 0,
    basePrice: 7500,
    description: "Dose química de contenção. Restaura +5 de humanidade. Vendido por Zé do Pó.",
  },
  {
    slug: "freio",
    name: "Freio",
    tier: 2,
    restoreAmount: 10,
    cooldownHours: 0,
    basePrice: 18000,
    description: "Regulador neural de emergência. Restaura +10 de humanidade.",
  },
  {
    slug: "choque",
    name: "Choque",
    tier: 3,
    restoreAmount: 15,
    cooldownHours: 0,
    basePrice: 30000,
    description: "Ressincronização forçada do sistema límbico. Restaura +15 de humanidade.",
  },
];
