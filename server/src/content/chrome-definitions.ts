import type { ChromeSlot } from "@neon-dusk/shared";

// Neon Dusk — Cromo Definitions Seed (ND-054 Data Seeding)
// ============================================================================
// 12 implant definitions for MVP (04-sistemas-e-progressao.md §3-4).
// Tiers 1-3; higher-tier cromo ships in Phase 2.
// Slugs are stable identifiers used by vendor inventory and loot tables.
// Issue #28 added the 7 missing slots/OS: skeleton, circulatory, legs
// (passives), the 3 OS implants (os-gazuah/os-fury/os-surge) and the
// Neural Scrubber (lazy regen +1/24h, cap 50 — frontal_cortex slot).

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
  // ── Issue #28: skeleton / circulatory / legs (passivos) ──────────────────
  {
    slug: "medula-reforcada",
    name: "Medula Reforçada",
    slot: "skeleton",
    tier: 2,
    bonuses: { max_hp: 10 },
    humanityCost: 6,
    basePrice: 4000,
    description:
      "Reconstituição de medula óssea de grau militar. +10 HP. Estrutura esquelética endurecida.",
  },
  {
    slug: "segundo-coracao",
    name: "Segundo Coração",
    slot: "circulatory",
    tier: 2,
    bonuses: { max_hp: 15 },
    humanityCost: 8,
    basePrice: 5500,
    description:
      "Bomba auxiliar implantada no tórax. +15 HP. Ativa automaticamente em parada cardíaca.",
  },
  {
    slug: "tornozelos-fortificados",
    name: "Tornozelos de Aço",
    slot: "legs",
    tier: 2,
    bonuses: { gig_success_rate: 8 },
    humanityCost: 6,
    basePrice: 4500,
    description:
      "Articulações reforçadas e amortecimento hidráulico. +8% sucesso em trampos e fugas.",
  },
  // ── Issue #28: OS implants (slot operating_system, permanentes por rodada) ─
  {
    slug: "os-gazuah",
    name: "SO Gazuá",
    slot: "operating_system",
    tier: 3,
    bonuses: {},
    humanityCost: 12,
    basePrice: 15000,
    description:
      "SO de hacking. Inerte nesta rodada: +40% RAM e quickhacks chegam na Fase 2. Escolha de build permanente por rodada.",
  },
  {
    slug: "os-fury",
    name: "SO Fúria",
    slot: "operating_system",
    tier: 3,
    bonuses: {},
    humanityCost: 10,
    basePrice: 12000,
    description:
      "SO de combate. Ativável 3x/dia: +50% Body por 60s. Escolha de build permanente por rodada.",
  },
  {
    slug: "os-surge",
    name: "SO Surto",
    slot: "operating_system",
    tier: 3,
    bonuses: {},
    humanityCost: 10,
    basePrice: 12000,
    description:
      "SO de velocidade. Ativável 5x/dia: +50% Reflexes e +25% de esquiva por 30s. Escolha de build permanente por rodada.",
  },
  // ── Issue #28: Neural Scrubber (regen lazy +1/24h, cap 50) ───────────────
  {
    slug: "neural-scrubber",
    name: "Lavador Neural",
    slot: "frontal_cortex",
    tier: 3,
    bonuses: {},
    humanityCost: 15,
    basePrice: 20000,
    description:
      "Filtro límbico passivo. Restaura +1 de humanidade por dia (máx. 50). Caro, discreto, necessário.",
  },
];
