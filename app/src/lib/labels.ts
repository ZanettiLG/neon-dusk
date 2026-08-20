import type {
  AbilityType,
  AttributeKey,
  GigPhase,
  GigType,
  Origin,
  Role,
} from "@neon-dusk/shared";

// Display labels (pt-BR) for game enums used across auth/character UI.

export const ORIGIN_LABELS: Record<Origin, string> = {
  a_paraiso: "A Paraíso",
  o_fervo: "O Fervo",
  o_fluxo: "O Fluxo",
  a_quebrada: "A Quebrada",
  babilonia: "Babilônia",
  as_mortas: "As Mortas",
  o_ponto: "O Ponto",
};

export const ROLE_LABELS: Record<Role, string> = {
  bicho: "Bicho",
  vulto: "Vulto",
  gambiarrista: "Gambiarrista",
  despachante: "Despachante",
  estradeiro: "Estradeiro",
};

/** Diegetic one-liner per banca (04-sistemas-e-progressao.md §0.4). */
export const ROLE_PHRASES: Record<Role, string> = {
  bicho: "Você não precisa ser mais rápido que a bala. Só mais rápido que o alvo.",
  vulto: "A fechadura mais forte do mundo não serve de nada se a porta é o cérebro do guarda.",
  gambiarrista: "Toda máquina tem um ponto fraco. Eu encontro. Você explode.",
  despachante: "Não importa o que você sabe. Importa quem você conhece. E eu conheço todo mundo.",
  estradeiro: "A estrada não tem dono. Só tem quem passa primeiro.",
};

/** Primary attributes per banca (04-sistemas-e-progressao.md §2). */
export const ROLE_PRIMARY_ATTRIBUTES: Record<Role, AttributeKey[]> = {
  bicho: ["body", "reflexes"],
  vulto: ["intelligence"],
  gambiarrista: ["technical"],
  despachante: ["cool"],
  estradeiro: ["reflexes"],
};

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  body: "Body",
  reflexes: "Reflexes",
  intelligence: "Intelligence",
  technical: "Technical",
  cool: "Cool",
};

// Trampos (ND-011): labels pt-BR para os tipos de trampo e o loop de 5 fases.
export const GIG_TYPE_LABELS: Record<GigType, string> = {
  extraction: "Extração",
  delivery: "Entrega",
  sabotage: "Sabotagem",
};

export const GIG_PHASE_LABELS: Record<GigPhase, string> = {
  meet: "Meet",
  legwork: "Legwork",
  execute: "Executar",
  escape: "Fuga",
  wrap_up: "Wrap Up",
};

// Slots de cromo (ND-010)
export const CHROME_SLOT_LABELS: Record<string, string> = {
  frontal_cortex: "Córtex Frontal",
  ocular: "Ocular",
  arms: "Braços",
  skeleton: "Esqueleto",
  nervous_system: "Sistema Nervoso",
  integumentary: "Tegumentar",
};

// Vendor types (ND-010)
export const VENDOR_TYPE_LABELS: Record<string, string> = {
  RIPPERDOC: "Ferrageiro",
  STIM_DEALER: "Traficante de ampolas",
  FIXER: "Despachante",
  BLACK_MARKET: "Mercado Negro",
};

// Vendor inventory (ND-010): item types are internal enums — display labels
// follow 06-terminologia-e-ip.md (implante → cromo, estimulante → ampola).
export const ITEM_TYPE_LABELS: Record<string, string> = {
  CHROME: "Cromo",
  CONSUMABLE: "Ampola",
  LOOT: "Saque",
};

// Display names for non-cromo vendor items. Internal itemId → PT label
// (itemId interno → Pingado conforme 06-terminologia-e-ip.md); cromo items get their
// name from the joined chrome_definitions row instead (see VendorDetailView).
export const ITEM_ID_LABELS: Record<string, string> = {
  "syn-cafe": "Pingado",
  "combat-stim": "Porrada",
  "access-chip": "Chip Frio",
};

// Banca abilities (04-sistemas-e-progressao.md §2) — canonical display names.
export const ABILITY_LABELS: Record<AbilityType, string> = {
  combat_trance: "Combat Trance",
  deep_dive: "Mergulho",
  overclock: "Overclock",
  silver_tongue: "Silver Tongue",
  long_haul: "Long Haul",
};
