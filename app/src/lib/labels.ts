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
  solo: "Solo",
  netrunner: "Netrunner",
  tech: "Tech",
  fixer: "Fixer",
  nomad: "Nomad",
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
