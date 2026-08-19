import type { AttributeKey, GigPhase, GigType, Origin, Role } from "@neon-dusk/shared";

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
  solo: "Bicho",
  netrunner: "Vulto",
  tech: "Gambiarrista",
  fixer: "Despachante",
  nomad: "Estradeiro",
};

/** Diegetic one-liner per banca (04-sistemas-e-progressao.md §0.4). */
export const ROLE_PHRASES: Record<Role, string> = {
  solo: "Você não precisa ser mais rápido que a bala. Só mais rápido que o alvo.",
  netrunner: "A fechadura mais forte do mundo não serve de nada se a porta é o cérebro do guarda.",
  tech: "Toda máquina tem um ponto fraco. Eu encontro. Você explode.",
  fixer: "Não importa o que você sabe. Importa quem você conhece. E eu conheço todo mundo.",
  nomad: "A estrada não tem dono. Só tem quem passa primeiro.",
};

/** Primary attributes per banca (04-sistemas-e-progressao.md §2). */
export const ROLE_PRIMARY_ATTRIBUTES: Record<Role, AttributeKey[]> = {
  solo: ["body", "reflexes"],
  netrunner: ["intelligence"],
  tech: ["technical"],
  fixer: ["cool"],
  nomad: ["reflexes"],
};

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  body: "Body",
  reflexes: "Reflexes",
  intelligence: "Intelligence",
  technical: "Technical",
  cool: "Cool",
};

// Gigs (ND-011): pt-BR labels for gig types and the 5-phase loop.
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

// Chrome slots (ND-010)
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
  STIM_DEALER: "Stim Dealer",
  FIXER: "Despachante",
  BLACK_MARKET: "Mercado Negro",
};
