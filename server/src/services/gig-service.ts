import type {
  ActiveGig,
  Attributes,
  GigAcceptResponse,
  GigBoardResponse,
  GigDetailResponse,
  GigEscapeResponse,
  GigExecuteResponse,
  GigHistoryEntry,
  GigHistoryResponse,
  GigListItem,
  GigTemplate,
  GigTier,
  GigType,
  GigWrapupResponse,
  Role,
} from "@neon-dusk/shared";
import { NIL_REGEN_INTERVAL_MS, NIL_REGEN_RATE } from "@neon-dusk/shared";
import { AppError } from "../middleware/error-handler";
import {
  applyHeatDecay,
  applyLegworkModifier,
  calculateEscapeChance,
  calculateHeat,
  calculatePayout,
  calculateStreetCred,
  calculateSuccessChance,
  canTransition,
  getEscapeStat,
  getPrimaryStatKey,
  getRelevantStats,
  isCooldownExpired,
  meetsStatRequirements,
  rollGigOutcome,
} from "../game/gigs";
import { calculateGigSuccessBonus, calculateStatBonus } from "../game/chrome";
import type { ChromeDefinition } from "@neon-dusk/shared";
import { calculateCrewBonuses } from "../game/crews.js";
import {
  getSilverTongueBonus,
  canRunSecondGig,
  computeConsumption,
} from "../game/abilities";
import { transferEddies } from "../game/economy";
import { emitEvent } from "../telemetry/emit-event";
import { withTransaction } from "../db";
import type { Queryable } from "../repositories";
import { characterRepository as characters } from "../repositories/character-repository";
import { walletRepository as wallets } from "../repositories/wallet-repository";
import { transactionRepository as transactions } from "../repositories/transaction-repository";
import { chromeRepository as chrome } from "../repositories/chrome-repository";
import { crewRepository as crews } from "../repositories/crew-repository";
import { heatRepository as heat } from "../repositories/heat-repository";
import { gigRepository as gigs } from "../repositories/gig-repository";
import type { ActiveGigJoinedRow } from "../repositories/gig-repository";

// Neon Dusk — Gig service (orchestration over the pure game logic)
// ============================================================================
// One active gig per character, 5-phase loop (meet → legwork → execute →
// escape → wrap_up, see 03-mecanicas-core.md §2). Phase values are produced
// by the game/gigs.ts state machine and stored verbatim. NIL spend (accept)
// and wallet credit (wrap up) use the same in-transaction optimistic-lock
// patterns as nil-service and chrome-service, so every multi-row write is
// atomic. All table access goes through the repositories (#158).

/** Map an active_gigs ⋈ gigs row to the API shape (ISO timestamps). */
function toActiveGig(row: ActiveGigJoinedRow): ActiveGig {
  return {
    id: row.id,
    gigId: row.gigId,
    gigName: row.gigName,
    gigType: row.gigType,
    gigTier: row.gigTier,
    phase: row.phase,
    status: row.status,
    acceptedAt: row.acceptedAt ? new Date(row.acceptedAt).toISOString() : new Date().toISOString(),
    legworkStartedAt: row.legworkStartedAt ? new Date(row.legworkStartedAt).toISOString() : null,
    legworkCompleted: row.legworkCompleted,
    legworkMinutes: row.legworkMinutes,
    executeOutcome: row.executeOutcome,
    escapeOutcome: row.escapeOutcome,
    actualPayout: row.actualPayout,
    escapeDifficulty: row.escapeDifficulty,
  };
}

/** Character row → Attributes object for the pure game functions. */
function toAttributes(row: Record<string, unknown> | { body: number; reflexes: number; intelligence: number; technical: number; cool: number }): Attributes {
  return {
    body: Number(row.body),
    reflexes: Number(row.reflexes),
    intelligence: Number(row.intelligence),
    technical: Number(row.technical),
    cool: Number(row.cool),
  };
}

/** postgres-js returns aggregate timestamps (max()) as UTC strings — normalize. */
function toDate(v: Date | string | null): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  // "2026-08-07 01:35:32.908572" (UTC) → ISO with Z so Date parses it as UTC.
  return new Date(v.includes("T") ? v : `${v.replace(" ", "T")}Z`);
}

/** Seconds left on a gig cooldown (0 = ready). */
function cooldownRemainingFor(lastAt: Date | string | null, cooldownMinutes: number, now: Date): number {
  const last = toDate(lastAt);
  if (!last) return 0;
  if (isCooldownExpired(last, cooldownMinutes, now)) return 0;
  const msLeft = last.getTime() + cooldownMinutes * 60 * 1000 - now.getTime();
  return Math.ceil(msLeft / 1000);
}

/** Sum of the character's installed-chrome gig success bonus (percentage points). */
async function getGigSuccessBonus(q: Queryable, characterId: string): Promise<number> {
  const installed = await chrome.listInstalledDefinitionIds(characterId, q);
  if (installed.length === 0) return 0;

  const defIds = installed.map((i) => i.chrome_definition_id);
  const defs = await chrome.listDefinitionsByIds(defIds, q);
  return calculateGigSuccessBonus(defs as unknown as ChromeDefinition[]);
}

/** Sum of the character's installed-chrome attribute bonuses (all 5 stats). */
async function getChromeStatBonus(
  q: Queryable,
  characterId: string,
): Promise<Attributes> {
  const installed = await chrome.listInstalledDefinitionIds(characterId, q);
  if (installed.length === 0) {
    return { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 };
  }

  const defIds = installed.map((i) => i.chrome_definition_id);
  const defs = await chrome.listDefinitionsByIds(defIds, q);
  return calculateStatBonus(defs as unknown as ChromeDefinition[]);
}

/**
 * Load the character's active gig joined with its template, or null.
 * Shared by every phase transition.
 */
async function queryActiveGig(
  characterId: string,
  q?: Queryable,
): Promise<ActiveGigJoinedRow | null> {
  return gigs.findActiveGig(characterId, q);
}

/** Best-effort telemetry write — a Redis/DB hiccup must never fail the action. */
function trackGigEvent(
  eventType: "GIG_STARTED" | "GIG_COMPLETED" | "GIG_FAILED",
  characterId: string,
  payload: Record<string, unknown>,
): void {
  void emitEvent({ eventType, actorId: characterId, payload }).catch(() => {
    // intentionally silent — telemetry is fire-and-forget
  });
}

/**
 * GET /api/gigs — the Despachante Cupim board: every gig with computed flags
 * (requirements met, cooldown), the character's active gig and today's count.
 */
export async function listAvailableGigs(characterId: string): Promise<GigBoardResponse> {
  const character = await characters.findById(characterId);
  if (!character) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

  const attrs = toAttributes(character);
  const now = new Date();

  const gigRows = await gigs.listCatalog();

  // Last completion per gig template → per-gig cooldowns.
  const completions = await gigs.listLastCompletions(characterId);
  const lastByGig = new Map(completions.map((c) => [c.gigId, c.lastAt as Date]));

  const board: GigListItem[] = gigRows.map((g) => {
    const requiredStats = g.required_stats as Record<string, number>;
    const meetsRequirements =
      meetsStatRequirements(attrs, requiredStats) && Number(character.street_cred) >= Number(g.required_street_cred);
    return {
      id: g.id as string,
      name: g.name as string,
      // ponytaill: Knex returns string for enum columns — cast to satisfy shared types
      tier: g.tier as GigListItem["tier"],
      type: g.type as GigListItem["type"],
      district: g.district as string,
      difficulty: Number(g.difficulty),
      baseReward: Number(g.base_reward),
      nilCost: Number(g.nil_cost),
      requiredStats,
      meetsRequirements,
      cooldownRemaining: cooldownRemainingFor(lastByGig.get(g.id as string) ?? null, Number(g.cooldown_minutes), now),
    };
  });

  const active = await queryActiveGig(characterId);

  return {
    gigs: board,
    activeGig: active ? toActiveGig(active) : null,
  };
}

/** GET /api/gigs/active — the character's active gig, or null. */
export async function getActiveGig(characterId: string): Promise<ActiveGig | null> {
  const active = await queryActiveGig(characterId);
  return active ? toActiveGig(active) : null;
}

/** GET /api/gigs/:id — one template with requirement/cooldown flags. */
export async function getGigDetail(
  characterId: string,
  gigId: string,
): Promise<GigDetailResponse> {
  const gig = await gigs.findById(gigId);
  if (!gig) throw new AppError(404, "GIG_NOT_FOUND", "Trampo não encontrado");

  const character = await characters.findById(characterId);
  if (!character) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

  const requiredStats = gig.required_stats as Record<string, number>;
  const meetsRequirements =
    meetsStatRequirements(toAttributes(character), requiredStats) &&
    Number(character.street_cred) >= Number(gig.required_street_cred);

  const last = await gigs.findLastCompletion(characterId, gigId);
  const cdRemaining = cooldownRemainingFor(last?.lastAt ?? null, Number(gig.cooldown_minutes), new Date());

  const template: GigTemplate = {
    id: gig.id as string,
    name: gig.name as string,
    description: gig.description as string,
    tier: gig.tier as GigTemplate["tier"],
    type: gig.type as GigTemplate["type"],
    district: gig.district as string,
    difficulty: Number(gig.difficulty),
    escapeDifficulty: Number(gig.escape_difficulty),
    requiredStats,
    requiredStreetCred: Number(gig.required_street_cred),
    baseReward: Number(gig.base_reward),
    nilCost: Number(gig.nil_cost),
    heatGenerated: Number(gig.heat_generated),
    legworkMinutes: Number(gig.legwork_minutes),
    cooldownMinutes: Number(gig.cooldown_minutes),
    meetsRequirements,
    cooldownRemaining: cdRemaining,
  };

  return { gig: template, meetsRequirements, cooldownRemaining: cdRemaining };
}

/**
 * POST /api/gigs/:id/accept — phase 1 (meet). Validates Moral, stats,
 * cooldown and NIL, then atomically opens an active gig.
 */
export async function acceptGig(characterId: string, gigId: string): Promise<GigAcceptResponse> {
  return withTransaction(async (trx) => {
    const character = await characters.findById(characterId, trx);
    if (!character) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

    const gig = await gigs.findById(gigId, trx);
    if (!gig) throw new AppError(404, "GIG_NOT_FOUND", "Trampo não encontrado");

    // Lock the row: INSERT first (unique character_id) — a concurrent accept
    // loses the race here and fails BEFORE any NIL is spent.
    const inserted = await gigs.openActiveGig(characterId, gigId, trx);
    if (!inserted) {
      // Feature #65: Long Haul — nomads can run a second concurrent gig when
      // the ability is active. ponytail: the DB unique constraint on
      // active_gigs.character_id still blocks this; drop it when Long Haul ships.
      const currentGigs = await gigs.countActiveGigs(characterId, trx);
      const longHaul = canRunSecondGig(
        character.role as Role,
        character.ability_active_until ? new Date(character.ability_active_until) : null,
        character.ability_cooldown_until ? new Date(character.ability_cooldown_until) : null,
        currentGigs,
      );
      if (longHaul) {
        // Consume Long Haul — the second gig starts now.
        const consumed = computeConsumption(character.role as Role);
        await characters.updateAbilityState(
          characterId,
          { activeUntil: consumed.activeUntil, cooldownUntil: consumed.cooldownUntil },
          trx,
        );
        // TODO: drop the unique constraint on active_gigs.character_id, then
        // allow the second INSERT to proceed here. For now, throw a clear error.
        throw new AppError(
          503,
          "LONG_HAUL_REQUIRES_MIGRATION",
          "Long Haul detectado, mas o schema ainda não suporta 2 trampos ativos. Aguarde a próxima migração.",
        );
      }
      throw new AppError(400, "ALREADY_ACTIVE_GIG", "Você já tem um trampo ativo");
    }

    try {
      if (Number(character.street_cred) < Number(gig.required_street_cred)) {
        throw new AppError(
          403,
          "INSUFFICIENT_STREET_CRED",
          `Precisa de ${gig.required_street_cred} de Moral, tem ${character.street_cred}.`,
        );
      }
      if (!meetsStatRequirements({
        body: Number(character.body),
        reflexes: Number(character.reflexes),
        intelligence: Number(character.intelligence),
        technical: Number(character.technical),
        cool: Number(character.cool),
      }, gig.required_stats as Record<string, number>)) {
        throw new AppError(403, "INSUFFICIENT_STATS", "Atributos não atendem aos requisitos do trampo");
      }

      const last = await gigs.findLastCompletion(characterId, gigId, trx);
      if (last && !isCooldownExpired(new Date(last.lastAt), Number(gig.cooldown_minutes))) {
        throw new AppError(400, "GIG_COOLDOWN", "Este trampo ainda está em cooldown");
      }

      // NIL spend (in-transaction, mirrors nil-service.consumeNil): persist the
      // passive regen snapshot AND deduct in one UPDATE. The gte guard is an
      // optimistic lock — a concurrent spend that passed the fail-fast check
      // still loses the WHERE race and gets INSUFFICIENT_NIL.
      const elapsed = Math.max(0, Date.now() - new Date(character.nil_updated_at).getTime());
      const regenOffset = Math.floor(elapsed / NIL_REGEN_INTERVAL_MS) * NIL_REGEN_RATE;
      const nilCost = Number(gig.nil_cost);
      const rawNil = Number(character.nil);

      const updated = await characters.updateNilSpend(characterId, regenOffset, nilCost, rawNil, trx);
      if (!updated) {
        throw new AppError(400, "INSUFFICIENT_NIL", `NIL insuficiente (precisa de ${nilCost})`);
      }

      const activeGig: ActiveGig = {
        id: inserted.id,
        gigId: gig.id,
        gigName: gig.name,
        gigType: gig.type,
        gigTier: gig.tier,
        phase: "meet",
        status: "active",
        acceptedAt: new Date(inserted.accepted_at).toISOString(),
        legworkStartedAt: null,
        legworkCompleted: false,
        legworkMinutes: Number(gig.legwork_minutes),
        executeOutcome: null,
        escapeOutcome: null,
        actualPayout: null,
        escapeDifficulty: Number(gig.escape_difficulty),
      };

      trackGigEvent("GIG_STARTED", characterId, { gigId: gig.id, gigName: gig.name, tier: gig.tier });
      return { activeGig, nilRemaining: updated.nil };
    } catch (err) {
      // Any validation failure after the INSERT rolls the gig back — the
      // player only pays NIL for a successfully accepted gig.
      await gigs.deleteActiveGig(inserted.id, trx);
      throw err;
    }
  });
}

/**
 * POST /api/gigs/:id/legwork — phase 2. Starts the legwork timer (5-30 min);
 * when it elapses, execute gets +20% success and payout.
 */
export async function doLegwork(characterId: string, gigId: string): Promise<ActiveGig> {
  return withTransaction(async (trx) => {
    const active = await queryActiveGig(characterId, trx);
    if (!active) throw new AppError(404, "NO_ACTIVE_GIG", "Nenhum trampo ativo");
    if (active.gigId !== gigId) throw new AppError(409, "GIG_MISMATCH", "Trampo ativo não corresponde");

    const next = canTransition(active.phase, "start_legwork");
    if (!next) {
      throw new AppError(409, "INVALID_PHASE_TRANSITION", `Não é possível iniciar legwork a partir de ${active.phase}`);
    }

    await gigs.transitionActiveGig(
      active.id,
      { phase: next, legwork_started_at: new Date(), updated_at: new Date() },
      trx,
    );

    return toActiveGig({ ...active, phase: next, legworkStartedAt: new Date() });
  });
}

/**
 * POST /api/gigs/:id/execute — phase 3. Rolls stats vs difficulty.
 * From `meet` it skips legwork (-20% success, "modo rápido"); from `legwork`
 * it applies the +20% bonus once the timer has elapsed.
 */
export async function executeGig(characterId: string, gigId: string): Promise<GigExecuteResponse> {
  return withTransaction(async (trx) => {
    const active = await queryActiveGig(characterId, trx);
    if (!active) throw new AppError(404, "NO_ACTIVE_GIG", "Nenhum trampo ativo");
    if (active.gigId !== gigId) throw new AppError(409, "GIG_MISMATCH", "Trampo ativo não corresponde");

    const gig = await gigs.findById(active.gigId, trx);
    if (!gig) throw new AppError(404, "GIG_NOT_FOUND", "Trampo não encontrado");

    const skippedLegwork = active.phase === "meet";
    const next =
      active.phase === "meet"
        ? canTransition("meet", "skip_to_execute")
        : active.phase === "legwork"
          ? canTransition("legwork", "execute")
          : null;
    if (!next) {
      throw new AppError(409, "INVALID_PHASE_TRANSITION", `Não é possível executar a partir de ${active.phase}`);
    }

    // Gate: if legwork was started, the timer must have elapsed (ND-078).
    const legworkDone =
      active.legworkStartedAt !== null &&
      Date.now() >= new Date(active.legworkStartedAt).getTime() + Number(gig.legwork_minutes) * 60 * 1000;
    if (!skippedLegwork && !legworkDone) {
      throw new AppError(
        409,
        "LEGWORK_IN_PROGRESS",
        "Legwork em andamento. Aguarde o timer.",
      );
    }

    const character = await characters.findById(characterId, trx);
    if (!character) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

    const { primary } = getRelevantStats(gig.type as GigType, toAttributes(character));
    // ponytail: sequential queries, JOIN if latency matters
    const chromeBonus = await getGigSuccessBonus(trx, characterId);
    const chromeStatBonuses = await getChromeStatBonus(trx, characterId);
    const primaryStatKey = getPrimaryStatKey(gig.type as GigType);
    const chromeStatBonusValue = chromeStatBonuses[primaryStatKey];

    // Crew bonus: +N percentage points to gig success (ND-016).
    let crewBonus = 0;
    if (character.crew_id) {
      const crewCount = await crews.memberCount(character.crew_id, trx);
      const bonuses = calculateCrewBonuses(crewCount);
      const gigBonus = bonuses.find((b) => b.type === "gig_success");
      if (gigBonus) crewBonus = gigBonus.value;
    }

    const baseChance = calculateSuccessChance(primary, chromeBonus, Number(gig.difficulty), undefined, chromeStatBonusValue);
    const chance = applyLegworkModifier(baseChance, { skippedLegwork, legworkDone });
    // Crew bonus adds percentage points after base chance (value=5 → +0.05).
    const chanceWithCrew = Math.min(0.95, chance + crewBonus / 100);

    const outcome = rollGigOutcome(chanceWithCrew);
    const actualPayout = outcome.success
      ? calculatePayout(Number(gig.base_reward), { legworkBonus: legworkDone, successBonus: true })
      : 0;

    await gigs.transitionActiveGig(
      active.id,
      {
        phase: next,
        legwork_completed: legworkDone,
        execute_outcome: outcome.success ? "success" : "failure",
        actual_payout: actualPayout,
        updated_at: new Date(),
      },
      trx,
    );

    return {
      activeGig: toActiveGig({
        ...active,
        phase: next,
        legworkCompleted: legworkDone,
        executeOutcome: outcome.success ? "success" : "failure",
        actualPayout: actualPayout,
      }),
      outcome: { success: outcome.success, roll: outcome.roll, successChance: outcome.successChance },
    };
  });
}

/**
 * POST /api/gigs/:id/escape — phase 4. Rolls vs escape difficulty with a
 * district-heat penalty (every 100 heat doubles the difficulty). Persists the
 * escape outcome; the heat it generates is committed at wrap up.
 */
export async function escapeGig(characterId: string, gigId: string): Promise<GigEscapeResponse> {
  return withTransaction(async (trx) => {
    const active = await queryActiveGig(characterId, trx);
    if (!active) throw new AppError(404, "NO_ACTIVE_GIG", "Nenhum trampo ativo");
    if (active.gigId !== gigId) throw new AppError(409, "GIG_MISMATCH", "Trampo ativo não corresponde");
    const gig = await gigs.findById(active.gigId, trx);
    if (!gig) throw new AppError(404, "GIG_NOT_FOUND", "Trampo não encontrado");

    // ponytail: idempotent escape — server already committed, client retrying
    if (active.phase === "escape") {
      const heatGenerated = calculateHeat(
        Number(gig.heat_generated),
        (active.executeOutcome ?? "failure") as "success" | "failure",
      );
      return {
        activeGig: toActiveGig(active),
        // roll: -1 is a sentinel for "previously rolled — details unavailable"
        outcome: { success: active.escapeOutcome === "success", roll: -1, successChance: 0 },
        heatGenerated,
      };
    }

    if (!canTransition(active.phase, "escape")) {
      throw new AppError(409, "INVALID_PHASE_TRANSITION", "Fuga só está disponível após executar");
    }

    const character = await characters.findById(characterId, trx);
    if (!character) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

    const districtHeat = await heat.getForDistrict(characterId, gig.district, trx);

    const { heat: effectiveHeat } = applyHeatDecay(
      Number(districtHeat?.amount ?? 0),
      districtHeat?.updated_at ? new Date(districtHeat.updated_at) : new Date(),
    );

    const stat = getEscapeStat(gig.type as GigType, toAttributes(character));
    const chance = calculateEscapeChance(stat, Number(gig.escape_difficulty), effectiveHeat);
    const outcome = rollGigOutcome(chance);
    const heatGenerated = calculateHeat(Number(gig.heat_generated), (active.executeOutcome ?? "failure") as "success" | "failure");

    await gigs.transitionActiveGig(
      active.id,
      {
        phase: "escape",
        escape_outcome: outcome.success ? "success" : "failure",
        updated_at: new Date(),
      },
      trx,
    );

    return {
      activeGig: toActiveGig({
        ...active,
        phase: "escape",
        escapeOutcome: outcome.success ? "success" : "failure",
      }),
      outcome: { success: outcome.success, roll: outcome.roll, successChance: outcome.successChance },
      heatGenerated,
    };
  });
}

/**
 * POST /api/gigs/:id/wrapup — phase 5. Resolves the gig: payout (execute
 * success only), Moral, district heat, history row — then closes the
 * active gig. All wallet/character/heat writes are one atomic transaction.
 */
export async function wrapUpGig(characterId: string, gigId: string): Promise<GigWrapupResponse> {
  return withTransaction(async (trx) => {
    const active = await queryActiveGig(characterId, trx);
    if (!active) throw new AppError(404, "NO_ACTIVE_GIG", "Nenhum trampo ativo");
    if (active.gigId !== gigId) throw new AppError(409, "GIG_MISMATCH", "Trampo ativo não corresponde");
    // The wrap_up action is taken while in the escape phase (see the phase
    // machine in game/gigs.ts: escape → wrap_up); wrap_up is terminal and the
    // row is deleted right after, so it is never observed by the client.
    if (active.phase !== "escape") {
      throw new AppError(409, "INVALID_PHASE_TRANSITION", "Wrap up só está disponível após escapar");
    }
    const terminalPhase = canTransition("escape", "wrap_up");

    const gig = await gigs.findById(active.gigId, trx);
    if (!gig) throw new AppError(404, "GIG_NOT_FOUND", "Trampo não encontrado");

    const character = await characters.findById(characterId, trx);
    if (!character) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

    // Feature #65: Silver Tongue — habilidade do despachante: +50% de pagamento e +25% de Moral.
    const silverTongue = getSilverTongueBonus(
      character.role as Role,
      character.ability_active_until ? new Date(character.ability_active_until) : null,
      character.ability_cooldown_until ? new Date(character.ability_cooldown_until) : null,
    );

    // Outcome: execute failure means the job was botched (no payout, no cred).
    const executed = active.executeOutcome === "success";
    const outcome = executed ? "success" : "failure";
    const basePayout = executed
      ? calculatePayout(Number(gig.base_reward), { legworkBonus: active.legworkCompleted, successBonus: true })
      : 0;
    const payout = silverTongue && basePayout > 0
      ? Math.ceil(basePayout * silverTongue.eddieMultiplier)
      : basePayout;
    const baseSC = executed ? calculateStreetCred(gig.tier as GigTier) : 0;
    const streetCredGained = silverTongue && baseSC > 0
      ? Math.ceil(baseSC * silverTongue.scMultiplier)
      : baseSC;
    const heatDelta = calculateHeat(Number(gig.heat_generated), (active.executeOutcome ?? "failure") as "success" | "failure");

    // 1. Wallet credit — optimistic lock (same pattern as buyFromVendor).
    const wallet = await wallets.ensure(characterId, trx);
    let newBalance = wallet.balance;
    if (payout > 0) {
      const result = transferEddies(wallet, payout, {
        type: "GIG_PAYOUT",
        source: `Trampo concluído: ${gig.name}`,
        referenceType: "gig",
        referenceId: gig.id,
      });
      const updatedWallet = await wallets.updateOptimistic(
        characterId,
        wallet.version,
        { balance: result.wallet.balance, lifetime_earned: result.wallet.lifetimeEarned },
        trx,
      );
      if (!updatedWallet) {
        throw new AppError(409, "CONCURRENCY_CONFLICT", "Carteira alterada concorrentemente. Tente novamente.");
      }
      await transactions.insert(
        {
          character_id: characterId,
          type: "GIG_PAYOUT",
          amount: payout,
          balance_before: result.transaction.balanceBefore,
          balance_after: result.transaction.balanceAfter,
          source: result.transaction.source,
          reference_type: "gig",
          reference_id: gig.id,
        },
        trx,
      );
      newBalance = updatedWallet.balance;
    }

    // 2. Moral — clamp at 100 so the DB CHECK never fires; report the
    // amount actually granted. Every wrap-up (success or failure) refreshes
    // `lastActivityAt` — playing resets the 7-day decay grace. The lifetime
    // max (decay floor) only ever grows.
    const currentSC = Number(character.street_cred);
    const newStreetCred = Math.min(100, currentSC + streetCredGained);
    const scGranted = newStreetCred - currentSC;
    await characters.updateStreetCredAndActivity(characterId, newStreetCred, trx);

    // Feature #65: consume Silver Tongue after the gig action.
    if (silverTongue) {
      const consumed = computeConsumption(character.role as Role);
      await characters.updateAbilityState(
        characterId,
        { activeUntil: consumed.activeUntil, cooldownUntil: consumed.cooldownUntil },
        trx,
      );
    }

    // 3. District heat — apply decay then upsert (one row per character + district).
    if (heatDelta > 0) {
      // Read current heat to apply lazy decay before adding new heat.
      const existingHeat = await heat.getForDistrict(characterId, gig.district as string, trx);

      const { heat: decayedHeat } = existingHeat
        ? applyHeatDecay(Number(existingHeat.amount), new Date(existingHeat.updated_at))
        : { heat: 0 };
      const newHeat = decayedHeat + heatDelta;

      await heat.upsert(characterId, gig.district as string, newHeat, trx);
    }

    // 4. History entry — the phases actually visited.
    const phasesCompleted = ["meet"];
    if (active.legworkStartedAt) phasesCompleted.push("legwork");
    phasesCompleted.push("execute", "escape", terminalPhase ?? "wrap_up");

    await gigs.insertHistory(
      {
        character_id: characterId,
        gig_id: gig.id,
        outcome,
        phases_completed: phasesCompleted,
        payout,
        street_cred_gained: scGranted,
        heat_accumulated: heatDelta,
        district: gig.district as string,
      },
      trx,
    );

    // 5. Close the active gig.
    await gigs.closeActiveGig(active.id, trx);

    trackGigEvent(
      outcome === "success" ? "GIG_COMPLETED" : "GIG_FAILED",
      characterId,
      { gigId: gig.id, gigName: gig.name, payout, streetCred: scGranted },
    );

    return {
      outcome,
      payout,
      streetCredGained: scGranted,
      heatAccumulated: heatDelta,
      newBalance,
    };
  });
}

/**
 * POST /api/gigs/:id/abandon — abandona o trampo ativo e o registra como
 * abandonado. Sem pagamento, sem Moral, sem heat. O despachante não vai
 * gostar, mas você sobrevive.
 */
export async function abandonGig(
  characterId: string,
  gigId: string,
): Promise<{ outcome: "abandoned"; message: string }> {
  return withTransaction(async (trx) => {
    // 1. Find active gig for this character.
    const active = await gigs.findActiveGigByGig(characterId, gigId, trx);
    if (!active) {
      throw new AppError(404, "NO_ACTIVE_GIG", "Nenhum trampo ativo para abandonar");
    }

    // 2. Get the gig district for the history entry.
    const gig = await gigs.findDistrict(active.gig_id, trx);
    const district = gig?.district ?? "Desconhecido";

    // 3. Delete active gig.
    await gigs.closeActiveGigsForCharacter(characterId, trx);

    // 4. Write history with outcome "abandoned".
    await gigs.insertHistory(
      {
        character_id: characterId,
        gig_id: gigId,
        outcome: "abandoned",
        phases_completed: [active.phase],
        district,
      },
      trx,
    );

    return {
      outcome: "abandoned" as const,
      message:
        "Trampo abandonado. O despachante não vai gostar, mas você vive para correr outro dia.",
    };
  });
}

/**
 * GET /api/gigs/history — completed gigs, newest first, cursor-paginated by
 * `completedAt` (ISO 8601). One extra row is read to detect the next page.
 */
export async function getGigHistory(
  characterId: string,
  limit: number = 20,
  cursor?: string,
): Promise<GigHistoryResponse> {
  const rows = await gigs.listHistory(characterId, limit, cursor);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const history: GigHistoryEntry[] = page.map((row) => ({
    id: row.id,
    gigId: row.gigId,
    gigName: row.gigName,
    tier: row.tier,
    type: row.type,
    outcome: row.outcome,
    payout: Number(row.payout),
    streetCredGained: Number(row.streetCredGained),
    heatAccumulated: Number(row.heatAccumulated),
    district: row.district,
    completedAt: new Date(row.completedAt).toISOString(),
  }));

  return {
    history,
    nextCursor: hasMore ? new Date(page[page.length - 1].completedAt).toISOString() : null,
  };
}
