import type { HumanityInfo } from "@neon-dusk/shared";
import { applyScrubberRegen, getHumanityBand, SCRUBBER_REGEN_CAP } from "../game/humanity";
import { THERAPY_OPTIONS, THERAPY_COOLDOWN_MS } from "../game/therapy";
import { AppError } from "../middleware/error-handler";
import { characterRepository as characters } from "../repositories/character-repository";
import { chromeRepository as chrome } from "../repositories/chrome-repository";
import { therapyRepository as therapy } from "../repositories/therapy-repository";

// Neon Dusk — Humanity service (readout + scrubber regen + therapy info)
// ============================================================================
// GET /api/humanity is a pure read: the scrubber's lazy regen is computed
// in-memory (never written — same pattern as NIL regen), the therapy
// cooldown is derived from the last therapy_sessions row.

/** Slug of the Neural Scrubber implant (regens +1/24h, cap 50). */
const SCRUBBER_SLUG = "neural-scrubber";

/**
 * GET /api/humanity — live humanity readout: band, flatline state,
 * scrubber regen status and therapy availability.
 */
export async function getHumanityInfo(characterId: string): Promise<HumanityInfo> {
  const character = await characters.findById(characterId);
  if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

  const scrubberInstalled = await chrome.isInstalledBySlug(characterId, SCRUBBER_SLUG);

  // Lazy regen: computed on read, never persisted by this endpoint. A
  // flatlined (apagado) character is permanently lost (04-sistemas §4) —
  // the scrubber must never pull them back above 0, so regen is skipped.
  const regen = scrubberInstalled && !character.is_flatlined
    ? applyScrubberRegen(character.humanity, character.humanity_updated_at, SCRUBBER_REGEN_CAP)
    : { humanity: character.humanity, regenApplied: 0, nextRegenAt: null };

  const lastSession = await therapy.findLastSession(characterId);
  const now = new Date();

  let nextAvailableAt: Date | null = null;
  if (lastSession) {
    const availableAt = new Date(lastSession.completed_at.getTime() + THERAPY_COOLDOWN_MS);
    if (availableAt.getTime() > now.getTime()) nextAvailableAt = availableAt;
  }

  return {
    humanity: regen.humanity,
    band: getHumanityBand(regen.humanity),
    flatlined: character.is_flatlined,
    flatlinedAt: character.flatlined_at ? character.flatlined_at.toISOString() : null,
    scrubber: {
      installed: scrubberInstalled,
      pendingRegen: regen.regenApplied,
      nextRegenAt: regen.nextRegenAt ? regen.nextRegenAt.toISOString() : null,
      cap: SCRUBBER_REGEN_CAP,
    },
    therapy: {
      lastCompletedAt: lastSession ? lastSession.completed_at.toISOString() : null,
      nextAvailableAt: nextAvailableAt ? nextAvailableAt.toISOString() : null,
      cooldownRemainingMs: nextAvailableAt ? Math.max(0, nextAvailableAt.getTime() - now.getTime()) : 0,
      clinic: {
        therapyType: "clinic",
        ...THERAPY_OPTIONS.clinic,
      },
      attunement: {
        therapyType: "attunement",
        ...THERAPY_OPTIONS.attunement,
      },
    },
  };
}