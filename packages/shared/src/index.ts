// @neon-dusk/shared — shared types barrel
// Types consumed by BOTH server and app. Add cross-package types here.

// --- Health ----------------------------------------------------------------

/** Response body of the `GET /api/health` endpoint. */
export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: string;
    redis: string;
  };
}

// --- Account & Character (Feature #1) ---------------------------------------

/** Character roles (5 classes). */
export const ROLES = ["solo", "netrunner", "tech", "fixer", "nomad"] as const;
export type Role = (typeof ROLES)[number];

/** Origin districts of São Paulo (7 districts). */
export const ORIGINS = [
  "a_paraiso",
  "o_fervo",
  "o_fluxo",
  "a_quebrada",
  "babilonia",
  "as_mortas",
  "o_ponto",
] as const;
export type Origin = (typeof ORIGINS)[number];

// Attribute constants — 3 base + 7 free points = 22 total across 5 attributes.
export const BASE_ATTRIBUTES = 3;
export const FREE_POINTS = 7;
export const ATTR_TOTAL = 22;
export const MIN_ATTR = 1;
export const MAX_ATTR = 20;
export const SOFT_CAP = 15;

export const ATTRIBUTE_KEYS = ["body", "reflexes", "intelligence", "technical", "cool"] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

/** Character attribute spread (each 1..20, sum 22). */
export interface Attributes {
  body: number;
  reflexes: number;
  intelligence: number;
  technical: number;
  cool: number;
}

/** Public user profile (no password hash). */
export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

/** Character owned by a user (1 user ↔ 1 character). */
export interface Character extends Attributes {
  id: string;
  userId: string;
  name: string;
  origin: Origin;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/auth/me response. */
export interface UserWithCharacter {
  user: User;
  character: Character | null;
}

// --- Requests ----------------------------------------------------------------

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface CreateCharacterRequest {
  name: string;
  origin: Origin;
  role: Role;
  attributes: Attributes;
}

// --- NIL (Feature #2) --------------------------------------------------------
// Energy system: regens +1 every 5 minutes, capped at max. Syn-café consumable
// restores 20 instantly with a 1h cooldown (see 03-mecanicas-core.md §1).

/** Base NIL cap for a new character (chrome raises it later). */
export const NIL_MAX_BASE = 100;
/** Passive regen cadence: 1 point per 5 minutes. */
export const NIL_REGEN_INTERVAL_MS = 5 * 60 * 1000;
/** NIL points restored per regen tick. */
export const NIL_REGEN_RATE = 1;
/** NIL restored by one syn-café. */
export const NIL_SYN_CAFE_AMOUNT = 20;
/** Syn-café cooldown, in seconds. */
export const NIL_SYN_CAFE_COOLDOWN_S = 60 * 60;

/** Live NIL readout (regen applied lazily, never written on GET). */
export interface NilStatus {
  current: number;
  max: number;
  /** Seconds until the next regen tick (0 when full). */
  nextTickSeconds: number;
  /** True when `current` is below `max` (regen pending). */
  regenerating: boolean;
  /** ISO timestamp of the last persisted NIL snapshot. */
  updatedAt: string;
}

export interface NilConsumeRequest {
  amount: number;
}

export interface NilConsumeResponse {
  consumed: number;
  /** NIL left after the deduction. */
  remaining: number;
  status: NilStatus;
}

export interface NilStimResponse {
  /** NIL actually restored (0 when already full). */
  added: number;
  status: NilStatus;
}

// --- Responses ---------------------------------------------------------------

/** POST /api/auth/register|login|refresh response. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  character: Character | null;
}
