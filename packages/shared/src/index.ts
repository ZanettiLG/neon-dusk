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
  /** Current street cred (0-100, may have decayed since the max). */
  streetCred: number;
  /** Highest street cred ever reached — the decay floor (§5). */
  maxStreetCredAchieved: number;
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

// --- Economy (Feature #3 / ND-010) -------------------------------------------
// Wallet balances are expressed in eddies (integers). Transaction types record
// every wallet movement; vendor types classify the NPC vendors.

export const TRANSACTION_TYPES = [
  "GIG_PAYOUT",
  "VENDOR_PURCHASE",
  "PVP_REWARD",
  "PVP_LOSS",
  "STIM_PURCHASE",
  "CREW_BONUS",
  "ADMIN_ADJUSTMENT",
  "CHROME_PURCHASE",
  "CHROME_UNINSTALL",
  "STREET_CRED_AWARD",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const VENDOR_TYPES = ["RIPPERDOC", "STIM_DEALER", "FIXER", "BLACK_MARKET"] as const;
export type VendorType = (typeof VENDOR_TYPES)[number];

/** Wallet readout. `escrow` is balance committed to pending deals (unspendable). */
export interface EconomyBalanceResponse {
  balance: number;
  escrow: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}

/** One entry in the append-only transaction audit trail. */
export interface TransactionRecord {
  id: string;
  characterId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

/** GET /api/economy/transactions response (cursor-based pagination). */
export interface TransactionListResponse {
  transactions: TransactionRecord[];
  nextCursor: string | null;
}

/** Public vendor listing entry. */
export interface VendorRecord {
  id: string;
  name: string;
  type: string;
  district: string;
  description?: string | null;
}

/** A sellable item at a vendor. `stock` -1 means unlimited. */
export interface VendorInventoryRecord {
  id: string;
  vendorId: string;
  itemType: string;
  itemId: string;
  price: number;
  stock: number;
}

/** GET /api/vendors/:id response. */
export interface VendorWithInventory {
  vendor: VendorRecord;
  inventory: VendorInventoryRecord[];
}

/** POST /api/vendors/:id/buy request body. */
export interface BuyRequest {
  itemType: string;
  itemId: string;
  quantity: number;
}

/** POST /api/vendors/:id/buy response. */
export interface BuyResponse {
  success: boolean;
  balanceBefore: number;
  balanceAfter: number;
  item: {
    itemType: string;
    itemId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  };
}

// --- Telemetry (ND-007) ------------------------------------------------------
// Game events are the single audit stream behind the ops dashboards: gigs,
// PVP, economy movements and NIL spends. The enum lives here so server,
// app and the DB enum (game_event_type) share one source of truth.

export const GAME_EVENT_TYPES = [
  "CHARACTER_CREATED",
  "GIG_STARTED",
  "GIG_COMPLETED",
  "GIG_FAILED",
  "PVP_ATTACK",
  "PVP_DEFEAT",
  "EDDIES_EARNED",
  "EDDIES_SPENT",
  "NIL_SPENT",
  "NIL_RESTORED",
  "VENDOR_PURCHASE",
] as const;
export type GameEventType = (typeof GAME_EVENT_TYPES)[number];

/** GET /api/admin/metrics response — recent activity digest. */
export interface AdminMetricsResponse {
  timestamp: string;
  events: {
    /** event_type → count over the last 24h. */
    last24h: Record<string, number>;
    /** event_type → count over the last 1h. */
    last1h: Record<string, number>;
  };
  economy: {
    eddiesEarned24h: number;
    eddiesSpent24h: number;
    nilSpent24h: number;
  };
  activity: {
    activeCharacters24h: number;
    gigsCompleted24h: number;
    gigsFailed24h: number;
    pvpAttacks24h: number;
  };
}

// --- Chrome (cyberware) -------------------------------------------------------
// Implants fill body slots, grant stat bonuses and drain humanity (100 base).
// Slot capacities and humanity pricing follow 04-sistemas-e-progressao.md §3-4.

/** Body slots an implant can occupy (MVP subset of the 9-slot table). */
export const CHROME_SLOTS = [
  "frontal_cortex",
  "ocular",
  "arms",
  "skeleton",
  "nervous_system",
  "integumentary",
] as const;
export type ChromeSlot = (typeof CHROME_SLOTS)[number];

/** How many implants fit per slot. */
export const SLOT_CAPACITY: Record<ChromeSlot, number> = {
  frontal_cortex: 3,
  ocular: 2,
  arms: 2,
  skeleton: 2,
  nervous_system: 3,
  integumentary: 3,
};

/** Stat deltas granted by an implant (all optional — an implant may give none). */
export interface ChromeBonuses {
  body?: number;
  reflexes?: number;
  intelligence?: number;
  technical?: number;
  cool?: number;
  max_hp?: number;
  gig_success_rate?: number;
}

/** Static chrome catalog entry (sold by ripperdocs). */
export interface ChromeDefinition {
  id: string;
  slug: string;
  name: string;
  slot: ChromeSlot;
  tier: number;
  bonuses: ChromeBonuses;
  humanityCost: number;
  basePrice: number;
  description?: string | null;
}

/** One installed implant (join of installed_chrome + chrome_definitions). */
export interface InstalledChromeRecord {
  installedId: string;
  installedAt: string;
  definition: ChromeDefinition;
}

/** GET /api/chrome/installed response — current loadout + effective bonuses. */
export interface InstalledChromeResponse {
  installed: InstalledChromeRecord[];
  /** Persisted humanity after all installs (never below 0). */
  effectiveHumanity: number;
  /** Total humanity drained by installed chrome. */
  humanitySpent: number;
  statBonus: Attributes;
  hpBonus: number;
  gigSuccessBonus: number;
}

/** POST /api/chrome/install response (201). */
export interface ChromeInstallResponse {
  installedChrome: InstalledChromeRecord;
  effectiveHumanity: number;
  walletBalance: number;
}

/** POST /api/chrome/uninstall response. */
export interface ChromeUninstallResponse {
  /** The slot freed by the uninstall. */
  freedSlot: ChromeSlot;
  /** Humanity is unchanged by uninstall (no refund, no recovery). */
  effectiveHumanity: number;
}

// ─── Gigs (Feature #4 / ND-011) ───────────────────────────────────────────
// The 5-phase loop of 03-mecanicas-core.md §2. NOTE: the terminal phase is
// `wrap_up` (not `wrapup`) — it matches the phase machine in
// server/src/game/gigs.ts (`canTransition`), which the service stores verbatim
// in active_gigs.phase.

export const GIG_TYPES = ["extraction", "delivery", "sabotage"] as const;
export type GigType = (typeof GIG_TYPES)[number];

export const GIG_TIERS = ["t1", "t2"] as const;
export type GigTier = (typeof GIG_TIERS)[number];

export const GIG_PHASES = ["meet", "legwork", "execute", "escape", "wrap_up"] as const;
export type GigPhase = (typeof GIG_PHASES)[number];

/** Gig template returned to client (one row of the static `gigs` catalog). */
export interface GigTemplate {
  id: string;
  name: string;
  description: string;
  tier: GigTier;
  type: GigType;
  district: string;
  difficulty: number;
  escapeDifficulty: number;
  requiredStats: Record<string, number>;
  requiredStreetCred: number;
  baseReward: number;
  nilCost: number;
  heatGenerated: number;
  legworkMinutes: number;
  cooldownMinutes: number;
  meetsRequirements?: boolean;
  cooldownRemaining?: number;
}

/** Condensed for the board list. */
export interface GigListItem {
  id: string;
  name: string;
  tier: GigTier;
  type: GigType;
  district: string;
  difficulty: number;
  baseReward: number;
  nilCost: number;
  /** Sparse attribute requirements (rendered as checked/unchecked chips). */
  requiredStats: Record<string, number>;
  meetsRequirements: boolean;
  cooldownRemaining: number;
}

/** Active gig state (one per character — `active_gigs.character_id` unique). */
export interface ActiveGig {
  id: string;
  gigId: string;
  gigName: string;
  gigType: string;
  gigTier: string;
  phase: string;
  status: string;
  acceptedAt: string;
  legworkStartedAt: string | null;
  legworkCompleted: boolean;
  legworkMinutes: number;
  executeOutcome: string | null;
  escapeOutcome: string | null;
  actualPayout: number | null;
  escapeDifficulty: number;
}

/** History entry (one row of `gig_history`). */
export interface GigHistoryEntry {
  id: string;
  gigId: string;
  gigName: string;
  tier: string;
  type: string;
  outcome: string;
  payout: number;
  streetCredGained: number;
  heatAccumulated: number;
  district: string;
  completedAt: string;
}

// Response types
export interface GigBoardResponse {
  gigs: GigListItem[];
  activeGig: ActiveGig | null;
  dailyCount: number;
}

export interface GigDetailResponse {
  gig: GigTemplate;
  meetsRequirements: boolean;
  cooldownRemaining: number;
}

export interface GigAcceptResponse {
  activeGig: ActiveGig;
  nilRemaining: number;
}

export interface GigExecuteResponse {
  activeGig: ActiveGig;
  outcome: { success: boolean; roll: number; successChance: number };
}

export interface GigEscapeResponse {
  activeGig: ActiveGig;
  outcome: { success: boolean; roll: number; successChance: number };
  heatGenerated: number;
}

export interface GigWrapupResponse {
  outcome: string;
  payout: number;
  streetCredGained: number;
  heatAccumulated: number;
  newBalance: number;
}

export interface GigHistoryResponse {
  history: GigHistoryEntry[];
  nextCursor: string | null;
}

// ─── Street Cred (ND-011.2) ─────────────────────────────────────────────────
// Reputation score 0-100: decays -5/day after a 7-day inactivity grace, never
// below the highest threshold reached (04-sistemas-e-progressao.md §5).

/** GET /api/street-cred response — live readout with decay applied. */
export interface StreetCredInfo {
  score: number;
  title: string;
  maxAchieved: number;
  /** The next threshold above `score` (null at Legend, score 100). */
  nextThreshold: { score: number; title: string } | null;
  /** Score points needed to reach `nextThreshold` (null at Legend). */
  scToNext: number | null;
}

/** One row of the public leaderboard. */
export interface LeaderboardEntry {
  position: number;
  characterName: string;
  /** Crew affiliation — null until crews ship (MVP has no crews). */
  crewName: string | null;
  score: number;
  title: string;
}

/** GET /api/street-cred/leaderboard response. */
export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

/** POST /api/street-cred/award request body. */
export interface AwardSCRequest {
  amount: number;
  source: string;
}

/** POST /api/street-cred/award response. */
export interface AwardSCResponse {
  score: number;
  title: string;
  /** Score actually granted (clamped at the 100 cap — 0 when already there). */
  gained: number;
  maxAchieved: number;
}
