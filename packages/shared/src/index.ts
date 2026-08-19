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

/** Character roles (5 bancas) — Neon Dusk brand names (06-terminologia-e-ip.md). */
export const ROLES = ["bicho", "vulto", "gambiarrista", "despachante", "estradeiro"] as const;
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
  role: "player" | "admin";
  createdAt: string;
  updatedAt: string;
}

// ─── Role Abilities (Feature #65) ──────────────────────────────────────────
// Each role has a unique active ability. Combat Trance is duration-based
// (30 min); all others are one-shot. Cooldowns vary per ability (4h–24h).

/** Active ability types — one per role. */
export const ABILITY_TYPES = [
  "combat_trance",
  "deep_dive",
  "overclock",
  "silver_tongue",
  "long_haul",
] as const;
export type AbilityType = (typeof ABILITY_TYPES)[number];

/** Maps each banca to its signature ability. */
export const ROLE_TO_ABILITY: Record<Role, AbilityType> = {
  bicho: "combat_trance",
  vulto: "deep_dive",
  gambiarrista: "overclock",
  despachante: "silver_tongue",
  estradeiro: "long_haul",
};

/** API readout of a character's current ability state. */
export interface AbilityState {
  abilityType: AbilityType;
  isActive: boolean;
  activeUntil: string | null;
  cooldownUntil: string | null;
  cooldownRemainingMs: number;
}

/** Character owned by a user (1 user ↔ 1 character). */
export interface Character extends Attributes {
  id: string;
  userId: string;
  name: string;
  origin: Origin;
  role: Role;
  /** Current Moral (0-100, may have decayed since the max). */
  streetCred: number;
  /** Highest Moral ever reached — the decay floor (§5). */
  maxStreetCredAchieved: number;
  /** Active role ability state (null when no ability timeline exists). */
  ability: AbilityState | null;
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
// Energy system: regens +1 every 5 minutes, capped at max. Pingado consumable
// restores 20 instantly with a 1h cooldown (see 03-mecanicas-core.md §1).

/** Base NIL cap for a new character (cromo raises it later). */
export const NIL_MAX_BASE = 100;
/** Passive regen cadence: 1 point per 5 minutes. */
export const NIL_REGEN_INTERVAL_MS = 5 * 60 * 1000;
/** NIL points restored per regen tick. */
export const NIL_REGEN_RATE = 1;
/** NIL restored by one Pingado (itemId interno; ver 06-terminologia-e-ip.md). */
export const NIL_SYN_CAFE_AMOUNT = 20;
/** Pingado cooldown, in seconds. */
export const NIL_SYN_CAFE_COOLDOWN_S = 3600;

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
// Wallet balances are expressed in Grana (integers). Transaction types record
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
  "CREW_CREATION",
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
  /** Chrome definition UUID when `itemType === "CHROME"`. */
  chromeDefinitionId?: string | null;
  /** Display name (chrome_definitions.name) when `itemType === "CHROME"`. */
  chromeDefinitionName?: string | null;
  /** Humanity cost when `itemType === "CHROME"`. */
  humanityCost?: number | null;
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
// Game events are the single audit stream behind the ops dashboards: trampos,
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
  "ABILITY_ACTIVATED",
  "ABILITY_CONSUMED",
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

// --- Player Events (ND-139) ---------------------------------------------------
// The runner dashboard event feed: a character's own game_events, mapped to a
// coarse severity for UI color + glyph. Cursor-paginated by createdAt.

/** Visual severity buckets for the event feed (color is never the only channel). */
export const CHARACTER_EVENT_SEVERITIES = ["info", "success", "warning", "danger"] as const;
export type CharacterEventSeverity = (typeof CHARACTER_EVENT_SEVERITIES)[number];

/** One game event as shown in the dashboard feed. */
export interface CharacterEvent {
  id: string;
  eventType: GameEventType;
  severity: CharacterEventSeverity;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** GET /api/characters/me/events response (cursor-paginated by createdAt). */
export interface CharacterEventsResponse {
  events: CharacterEvent[];
  nextCursor: string | null;
}

// --- Cromo (implantes) -------------------------------------------------------
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
  /** +NIL max cap per implant tier (frontal_cortex: +10/tier per design). */
  nil_max?: number;
}

/** Static cromo catalog entry (sold by ferrageiros). */
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
  /** Extra NIL cap granted by installed cromo (purely from nil_max bonuses). */
  nilMaxBonus: number;
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

// ─── Trampos (Feature #4 / ND-011) ───────────────────────────────────────────
// The 5-phase loop of 03-mecanicas-core.md §2. NOTE: the terminal phase is
// `wrap_up` (not `wrapup`) — it matches the phase machine in
// server/src/game/gigs.ts (`canTransition`), which the service stores verbatim
// in active_gigs.phase.

export const GIG_TYPES = ["extraction", "delivery", "sabotage"] as const;
export type GigType = (typeof GIG_TYPES)[number];

export const GIG_TIERS = ["t1", "t2", "t3", "t4", "t5"] as const;
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

/** Active trampo state (one per character — `active_gigs.character_id` unique). */
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

export interface GigAbandonResponse {
  outcome: "abandoned";
  message: string;
}

// ─── Moral (ND-011.2) ────────────────────────────────────────────────────────
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

// ─── PvP (ND-014) ───────────────────────────────────────────────────────────
// Player-vs-player combat: 20 NIL per attack, ±10 power bracket, weekly grief
// limit and daily defeat cap (04-sistemas-e-progressao.md §6).

/** POST /api/pvp/attack request body. */
export interface PvpAttackRequest {
  targetId: string;
}

/** POST /api/pvp/attack response — always from the attacker's perspective. */
export interface PvpCombatResult {
  combatId: string;
  won: boolean;
  attackerPower: number;
  defenderPower: number;
  lootAmount: number;
  /** Attacker's Moral change (positive on win, negative on loss). */
  streetCredChange: number;
  /** Attacker's Moral after the fight. */
  newStreetCred: number;
  /** Attacker's wallet balance after the fight. */
  newBalance: number;
}

/** One row of the GET /api/pvp/attackable list. */
export interface PvpTarget {
  characterId: string;
  name: string;
  streetCred: number;
  /** Full effective combat power (body + reflexes + cromo). */
  power: number;
  noobShield: boolean;
  weeklyAttacksReceived: number;
}

/** GET /api/pvp/attackable response. */
export interface PvpAttackableResponse {
  targets: PvpTarget[];
}

/** One row of the GET /api/pvp/history list. */
export interface PvpCombatRecord {
  id: string;
  attackerName: string;
  defenderName: string;
  attackerPower: number;
  defenderPower: number;
  winnerId: string;
  /** True when the calling character was the winner. */
  won: boolean;
  lootAmount: number;
  grieferPenalty: boolean;
  createdAt: string;
}

/** GET /api/pvp/history response (cursor-paginated by createdAt). */
export interface PvpHistoryResponse {
  combats: PvpCombatRecord[];
  nextCursor: string | null;
}

// ─── Saideira Hub (ND-015) ───────────────────────────────────────────────────
// The bar that never closes (Babilônia). Real-time chat via SSE + Redis
// pub/sub, permanent Legends hall of fame and the crew leaderboard (empty
// until ND-016 ships crews).

/** GET /api/saideira response — hub readout. */
export interface SaideiraHubInfo {
  /** Active characters tracked in the last 24h (auth:active:* keys). */
  onlineCount: number;
  /** ISO timestamp of the last round reset — null when no reset has occurred yet. */
  lastReset: string | null;
  /** Current round number (ND-017 — real data from the rounds table). */
  currentRound: number;
  /** ISO timestamp — when the current round ends. */
  roundEndsAt: string;
}

/** One chat message (Redis list entry + SSE frame). Message is HTML-escaped. */
export interface ChatMessage {
  id: string;
  characterName: string;
  /** Crew tag — null until ND-016 (crews). */
  crewTag: string | null;
  message: string;
  createdAt: string;
}

/** POST /api/saideira/chat request body. */
export interface ChatSendRequest {
  message: string;
}

/** GET /api/saideira/chat/history response — last 50, oldest first. */
export interface ChatHistoryResponse {
  messages: ChatMessage[];
}

/** One drink card on the Legends menu (permanent across round resets). */
export interface LegendEntry {
  id: string;
  characterName: string;
  drinkName: string;
  achievedAt: string;
  crewName: string | null;
}

/** GET /api/saideira/legends response. */
export interface LegendsResponse {
  legends: LegendEntry[];
}

/** One row of the crew ranking — placeholder until ND-016. */
export interface CrewLeaderboardEntry {
  position: number;
  crewName: string;
  totalSC: number;
  memberCount: number;
}

/** GET /api/saideira/leaderboard/crews response. */
export interface CrewLeaderboardResponse {
  crews: CrewLeaderboardEntry[];
}

// ─── Crews (ND-016: Crews Básicas) ──────────────────────────────────────────
// Gang social system: a leader founds a crew (5.000 de Grana, SC >= 25) and
// recruits up to 3 members (invite → join). Size unlocks cumulative bonuses
// (see server/src/game/crews.ts). The saideira chat (ND-015) and the street
// cred leaderboard (ND-011.2) both surface the crew affiliation.

/** Maximum crew size (leader + 3 recruits). */
export const CREW_MAX_SIZE = 4;
/** Moral required to found a crew. */
export const CREW_CREATE_SC = 25;
/** Eddy cost to found a crew (transaction type CREW_CREATION). */
export const CREW_CREATE_COST = 5000;
/** Moral a recruit must have to be invited. */
export const CREW_RECRUIT_SC = 10;

/** A crew (gang). */
export interface Crew {
  id: string;
  name: string;
  tag: string;
  leaderId: string;
  createdAt: string;
}

/** One crew member (join of crew_members + characters). */
export interface CrewMember {
  id: string;
  characterId: string;
  characterName: string;
  streetCred: number;
  joinedAt: string;
}

/** A pending membership invite (24h TTL). */
export interface CrewInvite {
  id: string;
  crewId: string;
  characterId: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

/** Size-based crew bonus (server/src/game/crews.ts). */
export interface CrewBonus {
  type: "gig_success" | "eddies" | "street_cred";
  description: string;
  value: number;
}

/** POST /api/crews request body. */
export interface CreateCrewRequest {
  name: string;
  tag: string;
}

/** POST /api/crews response (201). */
export interface CreateCrewResponse {
  crew: Crew;
  member: CrewMember;
}

/** POST /api/crews/:id/invite request body. */
export interface CrewInviteRequest {
  characterId: string;
}

/** GET /api/crews/:id response — crew, members, bonuses and ranking. */
export interface CrewDetailResponse {
  crew: Crew;
  members: CrewMember[];
  bonuses: CrewBonus[];
  /** 1-based position in the total-SC crew ranking (null when unranked). */
  leaderboardPosition: number | null;
}

// ─── Round System (ND-017) ───────────────────────────────────────────────────
// 14-day rounds with a full server-side reset. The DB enum only has
// active/ended; "intermission" is derived in the API when the next round is
// scheduled but has not started yet.

/** Round lifecycle states as reported by the API. */
export type RoundStatus = "active" | "ended" | "intermission";

/** GET /api/round response — current round info with countdown. */
export interface RoundInfoResponse {
  roundNumber: number;
  startedAt: string;
  endsAt: string;
  /** Seconds until the round ends (0 when ended or in intermission). */
  timeRemainingSeconds: number;
  status: RoundStatus;
  /** ISO timestamp when the next round starts (null when a round is active). */
  intermissionUntil: string | null;
}

/** Stats captured at round end (snapshot taken before the data wipe). */
export interface RoundStatsSnapshot {
  totalGigsCompleted: number;
  totalEddiesEarned: number;
  totalPvpFights: number;
  totalActiveCharacters: number;
  topCrewName: string | null;
  topScCharacterName: string | null;
  /** Moral of the top-scoring character (null when no characters). */
  topScValue: number | null;
}

/** One entry in GET /api/round/history (ended rounds only). */
export interface RoundHistoryEntry {
  roundNumber: number;
  startedAt: string;
  endedAt: string;
  stats: RoundStatsSnapshot;
}

/** GET /api/round/history response (cursor-paginated by round_number DESC). */
export interface RoundHistoryResponse {
  rounds: RoundHistoryEntry[];
  nextCursor: number | null;
}

/** POST /api/round/trigger-reset response (admin only). */
export interface TriggerResetResponse {
  success: true;
  endedRound: number;
  newRound: number;
  legendsInducted: number;
}

// ─── Name Drink (ND-017) ─────────────────────────────────────────────────────

/** POST /api/legends/name-drink request body. */
export interface NameDrinkRequest {
  /** 3-30 chars, trimmed. */
  drinkName: string;
}

/** POST /api/legends/name-drink response — the named legend record. */
export interface NameDrinkResponse {
  legend: {
    id: string;
    characterName: string;
    drinkName: string;
    achievedAt: string;
    crewName: string | null;
  };
}

// ─── Admin Panel (ND-052) ─────────────────────────────────────────────────────
// Role-based admin panel for Beta operations. Types shared between
// server (API) and app (Zustand stores, views).

/** One player row in the admin player list. */
export interface AdminPlayer {
  id: string;
  name: string;
  level: number;
  sc: number;
  eddies: number;
  crew: string | null;
  lastLogin: string | null;
  status: "active" | "banned" | "circuit_broken";
}

/** GET /api/admin/players response (paginated). */
export interface AdminPlayersResponse {
  players: AdminPlayer[];
  total: number;
  page: number;
  pageSize: number;
}

/** Economy dashboard snapshot. */
export interface AdminEconomy {
  eddiesInCirculation: number;
  topFaucets24h: { source: string; amount: number }[];
  topSinks24h: { source: string; amount: number }[];
  dailyActiveCharacters: number;
  transactions24h: number;
  hourlyBreakdown24h: { hour: string; count: number }[];
}

/** One audit log entry (IP masked). */
export interface AdminAuditEntry {
  id: string;
  timestamp: string;
  characterName: string | null;
  action: string;
  result: string;
  payload: Record<string, unknown>;
  ip: string;
}

/** GET /api/admin/audit response (cursor-paginated). */
export interface AdminAuditResponse {
  entries: AdminAuditEntry[];
  nextCursor: string | null;
}

/** POST /api/admin/players/:id/ban request body. */
export interface BanPlayerRequest {
  reason: string;
}

/** PATCH /api/admin/params request body. */
export interface UpdateParamsRequest {
  params: Record<string, string>;
}

/** GET /api/admin/transactions response. */
export interface AdminTransaction {
  id: string;
  characterName: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source: string;
  createdAt: string;
}

export interface AdminTransactionsResponse {
  transactions: AdminTransaction[];
  total: number;
}
