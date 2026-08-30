import type { TherapyRequest, TherapyResponse, TherapyType } from "@neon-dusk/shared";
import { canUndergoTherapy, computeTherapyOutcome, THERAPY_COOLDOWN_MS } from "../game/therapy";
import { clampHumanity } from "../game/humanity";
import { transferEddies } from "../game/economy";
import { AppError } from "../middleware/error-handler";
import { emitEvent } from "../telemetry/emit-event";
import { withTransaction } from "../db";
import { characterRepository as characters } from "../repositories/character-repository";
import { walletRepository as wallets } from "../repositories/wallet-repository";
import { transactionRepository as transactions } from "../repositories/transaction-repository";
import { therapyRepository as therapy } from "../repositories/therapy-repository";

// Neon Dusk — Therapy service
// ============================================================================
// One atomic transaction: lock the character → flatline gate → 24h cooldown
// gate (shared between clinic and attunement) → roll cost/restore → wallet
// debit (optimistic lock, available = balance − escrow) → humanity restore
// (capped at 100) → therapy_sessions row → THERAPY_COMPLETED telemetry.

/**
 * POST /api/therapy — undergo a therapy session (clínica or sintonia).
 *
 * Error codes: 429 COOLDOWN_ACTIVE (details.nextAvailableAt),
 * 400 INSUFFICIENT_EDDIES, 403 FLATLINED.
 */
export async function undergoTherapy(
  characterId: string,
  body: TherapyRequest,
): Promise<TherapyResponse> {
  const therapyType = body.therapyType;

  return withTransaction(async (trx) => {
    const character = await characters.findByIdForUpdate(characterId, trx);
    if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

    if (character.is_flatlined) {
      throw new AppError(403, "FLATLINED", "Personagem apagado. Sem ações permitidas.");
    }

    const lastSession = await therapy.findLastSession(characterId, trx);
    const cooldown = canUndergoTherapy(
      lastSession ? lastSession.completed_at : null,
      THERAPY_COOLDOWN_MS,
    );
    if (!cooldown.canUndergo) {
      // ND-053: 429 COOLDOWN_ACTIVE — same convention as consumables, PvP and
      // the anti-cheat middleware (issue #28 review, cycle 2). The unlock time
      // rides in details.nextAvailableAt.
      throw new AppError(429, "COOLDOWN_ACTIVE", "Você já fez terapia nas últimas 24h.", {
        nextAvailableAt: cooldown.nextAvailableAt?.toISOString() ?? null,
      });
    }

    const outcome = computeTherapyOutcome(therapyType as TherapyType);

    // Wallet debit with optimistic locking (pattern of economy-service.transfer).
    const wallet = await wallets.ensure(characterId, trx);
    const availableFunds = wallet.balance - wallet.escrow;
    if (availableFunds < outcome.cost) {
      throw new AppError(
        400,
        "INSUFFICIENT_EDDIES",
        `Precisa de G$ ${outcome.cost} disponível, tem G$ ${availableFunds}.`,
      );
    }

    const result = transferEddies(wallet, -outcome.cost, {
      type: "THERAPY_PAYMENT",
      source: `Sessão de terapia (${therapyType})`,
    });

    const updatedWallet = await wallets.updateOptimistic(
      characterId,
      wallet.version,
      {
        balance: result.wallet.balance,
        escrow: result.wallet.escrow,
        lifetime_spent: result.wallet.lifetimeSpent,
      },
      trx,
    );
    if (!updatedWallet) {
      throw new AppError(409, "CONCURRENCY_CONFLICT", "Modificação concorrente detectada. Tente novamente.");
    }

    await transactions.insert(
      {
        character_id: characterId,
        type: "THERAPY_PAYMENT",
        amount: -outcome.cost,
        balance_before: result.transaction.balanceBefore,
        balance_after: result.transaction.balanceAfter,
        source: result.transaction.source,
      },
      trx,
    );

    const humanityBefore = character.humanity;
    const humanityAfter = clampHumanity(humanityBefore + outcome.restored);
    const restored = humanityAfter - humanityBefore;

    if (restored > 0) {
      await characters.updateHumanity(characterId, humanityAfter, trx);
    }

    const session = await therapy.insertSession(
      {
        character_id: characterId,
        therapy_type: therapyType,
        cost: outcome.cost,
        restored,
        humanity_before: humanityBefore,
        humanity_after: humanityAfter,
      },
      trx,
    );

    // Fire-and-forget telemetry.
    void emitEvent({
      eventType: "THERAPY_COMPLETED",
      actorId: characterId,
      payload: { therapyType, cost: outcome.cost, restored },
    }).catch(() => {
      // intentionally silent
    });

    return {
      therapyType: therapyType as TherapyType,
      cost: outcome.cost,
      restored,
      humanityBefore,
      humanityAfter,
      completedAt: session.completed_at.toISOString(),
    };
  });
}