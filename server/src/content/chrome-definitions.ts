import type { ChromeSlot } from "@neon-dusk/shared";

// Neon Dusk — Cromo Definitions Seed (ND-054 Data Seeding)
// ============================================================================
// 5 implant definitions for MVP (04-sistemas-e-progressao.md §3-4).
// Tiers 1-2 only; higher-tier cromo ships in Phase 2.
// Slugs are stable identifiers used by vendor inventory and loot tables.

export interface ChromeSeedEntry {
  slug: string;
  name: string;
  slot: ChromeSlot;
  tier: number;
  bonuses: Record<string, number>;
  humanityCost: number;
  basePrice: number;
  description: string;
}

export const CHROME_DEFINITIONS: ChromeSeedEntry[] = [
  {
    slug: "neural-booster",
    name: "Cuca Acesa",
    slot: "frontal_cortex",
    tier: 1,
    bonuses: { intelligence: 2, nil_max: 10 },
    humanityCost: 3,
    basePrice: 1500,
    description:
      "Aprimoramento neural básico. +2 INT, +10 NIL máximo. Processamento sináptico acelerado em 40%.",
  },
  {
    slug: "reflex-tuner",
    name: "Estalo",
    slot: "nervous_system",
    tier: 1,
    bonuses: { reflexes: 2 },
    humanityCost: 3,
    basePrice: 1500,
    description:
      "Sintonizador de reflexos. +2 REF. Tempo de reação reduzido em 35ms.",
  },
  {
    slug: "kiroshi-optics",
    name: "Óptica Vidraça",
    slot: "ocular",
    tier: 1,
    bonuses: { reflexes: 2, gig_success_rate: 5 },
    humanityCost: 4,
    basePrice: 1800,
    description:
      "Óptica Vidraça de entrada. +2 REF, +5% sucesso em trampos. Scanner térmico integrado.",
  },
  {
    slug: "gorilla-arms",
    name: "Braço de Ferro",
    slot: "arms",
    tier: 2,
    bonuses: { body: 3 },
    humanityCost: 8,
    basePrice: 5000,
    description:
      "Braços hidráulicos militares. +3 BOD. Força de impacto de 800kg.",
  },
  {
    slug: "subdermal-armor",
    name: "Casca Grossa",
    slot: "integumentary",
    tier: 2,
    bonuses: { max_hp: 10 },
    humanityCost: 6,
    basePrice: 4000,
    description:
      "Malha dérmica balística. +10 HP. Resistência a perfurações e cortes.",
  },
];
