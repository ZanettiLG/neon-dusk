import type { Knex } from "knex";
import type {
  ChromeBonuses,
  ChromeDefinition,
  ChromeInstallResponse,
  ChromeSlot,
  ChromeUninstallResponse,
  InstalledChromeRecord,
  InstalledChromeResponse,
} from "@neon-dusk/shared";
import { SLOT_CAPACITY, NIL_MAX_BASE } from "@neon-dusk/shared";
import { db } from "../db";
import type { Queryable } from "../db";
import { AppError } from "../middleware/error-handler";
import {
  calculateGigSuccessBonus,
  calculateHpBonus,
  calculateHumanityCost,
  calculateNilMaxBonus,
  calculateStatBonus,
  validateHumanityAfterInstall,
  validateSlotAvailability,
} from "../game/chrome";
import { transferEddies } from "../game/economy";
import { getOverclockBonus, computeConsumption } from "../game/abilities";
import { ensureWallet } from "./economy-service";

// Neon Dusk — Chrome service (install / uninstall / loadout / catalog)
// ============================================================================
// Install is a single PostgreSQL transaction: vendor stock check → wallet
// debit (optimistic lock, same pattern as buyFromVendor) → audit entry →
// implant insert → atomic humanity decrement. The UPDATE's WHERE guard
// (`humanity >= cost`) re-validates the cost against the row's current
// humanity at write time, so concurrent installs that both read the same
// value can never overwrite each other's deduction.

/** Database row shape for chrome_definitions (snake_case columns). */
interface DbChromeDefinition {
  id: string;
  slug: string;
  name: string;
  slot: string;
  tier: number;
  bonuses: ChromeBonuses;
  humanity_cost: number;
  base_price: number;
  description: string | null;
  is_active: boolean;
}

/** Database row shape for installed_chrome (snake_case columns). */
interface DbInstalledChrome {
  id: string;
  character_id: string;
  chrome_definition_id: string;
  installed_at: Date;
}

/** DB row → API shape (snake → camel; strips is_active internals). */
function toPublicDefinition(row: DbChromeDefinition): ChromeDefinition {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    slot: row.slot as ChromeSlot,
    tier: row.tier,
    bonuses: row.bonuses,
    humanityCost: row.humanity_cost,
    basePrice: row.base_price,
    description: row.description ?? undefined,
  };
}

/** Detect Postgres unique violation (SQLSTATE 23505). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * Install chrome bought from a ripperdoc. Validates the implant, the vendor
 * stock, the slot capacity and the humanity cost, then atomically debits the
 * wallet and records the implant + audit entry. Returns the new loadout entry,
 * the effective humanity and the post-purchase wallet balance.
 */
export async function installChrome(
  characterId: string,
  chromeDefinitionId: string,
  vendorId: string,
): Promise<ChromeInstallResponse> {
  // 1. Chrome definition must exist and be active
  const [definition] = await db("chrome_definitions")
    .select()
    .where("id", chromeDefinitionId)
    .where("is_active", true)
    .limit(1);
  if (!definition) throw new AppError(404, "CHROME_NOT_FOUND", "Chrome não encontrado");

  // 2. Vendor must stock this chrome (item_type='CHROME', item_id=slug)
  const [stockItem] = await db("vendor_inventory")
    .select()
    .where("vendor_id", vendorId)
    .where("item_type", "CHROME")
    .where("item_id", definition.slug)
    .limit(1);
  if (!stockItem) {
    throw new AppError(404, "ITEM_NOT_FOUND", "Este ripperdoc não tem esse chrome em estoque");
  }

  return db.transaction(async (trx) => {
    // 3. Character — humanity read fresh inside the tx (it guards the write)
    const [character] = await trx("characters")
      .select("humanity", "role", "ability_active_until", "ability_cooldown_until")
      .where("id", characterId)
      .limit(1);
    if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

    // Feature #65: Overclock — 50% discount + 0 humanity cost for techs.
    const overclockActive = getOverclockBonus(
      character.role,
      character.ability_active_until,
      character.ability_cooldown_until,
    );

    // 4. Current loadout — duplicate check + per-slot count
    const loadout = await trx("installed_chrome")
      .select("installed_chrome.chrome_definition_id as definitionId", "chrome_definitions.slot")
      .join("chrome_definitions", "installed_chrome.chrome_definition_id", "=", "chrome_definitions.id")
      .where("installed_chrome.character_id", characterId);

    if (loadout.some((row: { definitionId: string }) => row.definitionId === chromeDefinitionId)) {
      throw new AppError(409, "ALREADY_INSTALLED", "Chrome já instalado");
    }

    // 5. Slot capacity (one definition per install, so counts never double)
    const installedInSlot = loadout.filter((row: { slot: string }) => row.slot === definition.slot).length;
    if (!validateSlotAvailability(definition.slot as ChromeSlot, installedInSlot)) {
      throw new AppError(
        400,
        "SLOT_FULL",
        `No free ${definition.slot} slot (${installedInSlot}/${SLOT_CAPACITY[definition.slot as ChromeSlot]})`,
      );
    }

    // 6. Humanity cost — overclock makes it free
    const effectiveHumanityCost = overclockActive ? 0 : definition.humanity_cost;
    if (!validateHumanityAfterInstall(character.humanity, effectiveHumanityCost)) {
      throw new AppError(400, "HUMANITY_TOO_LOW", "Humanidade insuficiente para instalar este chrome");
    }

    // 7. Wallet debit with optimistic locking (pattern of buyFromVendor)
    const wallet = await ensureWallet(characterId, trx as unknown as Queryable);
    // overclock: 50% discount on chrome price
    const price = overclockActive ? Math.ceil(stockItem.price * 0.5) : stockItem.price;
    const availableFunds = wallet.balance - wallet.escrow;
    if (availableFunds < price) {
      throw new AppError(400, "INSUFFICIENT_FUNDS", `Precisa de ${price} eddies, tem ${availableFunds}`);
    }

    const result = transferEddies(wallet, -price, {
      type: "CHROME_PURCHASE",
      source: `Purchased ${definition.name} (${definition.slug}) from vendor ${vendorId}`,
      referenceType: "chrome_definition",
      referenceId: definition.id,
    });

    const [updatedWallet] = await trx("character_wallets")
      .update({
        balance: result.wallet.balance,
        escrow: result.wallet.escrow,
        lifetime_spent: result.wallet.lifetimeSpent,
        version: wallet.version + 1,
        updated_at: new Date(),
      })
      .where("character_id", characterId)
      .where("version", wallet.version)
      .returning("*");
    if (!updatedWallet) {
      throw new AppError(409, "CONCURRENCY_CONFLICT", "Modificação concorrente detectada. Tente novamente.");
    }

    // Audit entry
    await trx("transaction_log").insert({
      character_id: characterId,
      type: "CHROME_PURCHASE",
      amount: -price,
      balance_before: result.transaction.balanceBefore,
      balance_after: result.transaction.balanceAfter,
      source: result.transaction.source,
      reference_type: "chrome_definition",
      reference_id: definition.id,
    });

    // Implant record — unique(character, definition) is the last line of
    // defense against concurrent duplicate installs.
    let installed: DbInstalledChrome;
    try {
      const rows = await trx("installed_chrome")
        .insert({ character_id: characterId, chrome_definition_id: definition.id })
        .returning("*");
      [installed] = rows;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(409, "ALREADY_INSTALLED", "Chrome já instalado");
      }
      throw err;
    }

    // Atomic humanity decrement — zero when overclock is active.
    const effectiveHumanity = character.humanity - effectiveHumanityCost;
    if (effectiveHumanityCost > 0) {
      await trx("characters")
        .update({ humanity: effectiveHumanity, updated_at: new Date() })
        .where("id", characterId)
        .where("humanity", ">=", effectiveHumanityCost);
    }

    // Feature #65: consume Overclock after successful install.
    if (overclockActive) {
      const consumed = computeConsumption(character.role);
      await trx("characters")
        .update({
          ability_active_until: consumed.activeUntil,
          ability_cooldown_until: consumed.cooldownUntil,
          updated_at: new Date(),
        })
        .where("id", characterId);
    }

    // Recompute effective NIL max from all installed chrome (base 100 + nil_max bonuses).
    const installedDefs = await trx("chrome_definitions")
      .select("chrome_definitions.bonuses")
      .join("installed_chrome", "installed_chrome.chrome_definition_id", "=", "chrome_definitions.id")
      .where("installed_chrome.character_id", characterId);
    const nilMaxBonus = calculateNilMaxBonus(
      installedDefs.map((d: { bonuses: ChromeBonuses }) =>
        ({ bonuses: d.bonuses } as ChromeDefinition),
      ),
    );
    await trx("characters")
      .update({ max_nil: NIL_MAX_BASE + nilMaxBonus, updated_at: new Date() })
      .where("id", characterId);

    return {
      installedChrome: {
        installedId: installed.id,
        installedAt: installed.installed_at.toISOString(),
        definition: toPublicDefinition(definition),
      },
      effectiveHumanity,
      walletBalance: result.wallet.balance,
    };
  });
}

/**
 * Remove an installed implant. No eddie refund and no humanity recovery —
 * only an audit entry (amount 0, so the balance CHECK still holds). Returns
 * the freed slot and the unchanged effective humanity.
 */
export async function uninstallChrome(
  characterId: string,
  installedChromeId: string,
): Promise<ChromeUninstallResponse> {
  // Load the implant joined with its definition; scoping by characterId makes
  // a foreign id indistinguishable from a missing one (404 either way).
  const [row] = await db("installed_chrome")
    .select(
      "installed_chrome.id",
      "chrome_definitions.name",
      "chrome_definitions.slot",
    )
    .join("chrome_definitions", "installed_chrome.chrome_definition_id", "=", "chrome_definitions.id")
    .where("installed_chrome.id", installedChromeId)
    .where("installed_chrome.character_id", characterId)
    .limit(1);
  if (!row) throw new AppError(404, "INSTALLED_CHROME_NOT_FOUND", "Chrome instalado não encontrado");

  const [character] = await db("characters")
    .select("humanity")
    .where("id", characterId)
    .limit(1);
  if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

  await db.transaction(async (trx) => {
    await trx("installed_chrome").delete().where("id", installedChromeId);

    // Recompute effective NIL max from remaining chrome.
    const remaining = await trx("chrome_definitions")
      .select("chrome_definitions.bonuses")
      .join("installed_chrome", "installed_chrome.chrome_definition_id", "=", "chrome_definitions.id")
      .where("installed_chrome.character_id", characterId);
    const nilMaxBonus = calculateNilMaxBonus(
      remaining.map((d: { bonuses: ChromeBonuses }) =>
        ({ bonuses: d.bonuses } as ChromeDefinition),
      ),
    );
    await trx("characters")
      .update({ max_nil: NIL_MAX_BASE + nilMaxBonus, updated_at: new Date() })
      .where("id", characterId);

    // Audit-only entry: no wallet movement, so balanceBefore = balanceAfter.
    const wallet = await ensureWallet(characterId, trx as unknown as Queryable);
    await trx("transaction_log").insert({
      character_id: characterId,
      type: "CHROME_UNINSTALL",
      amount: 0,
      balance_before: wallet.balance,
      balance_after: wallet.balance,
      source: `Uninstalled ${row.name}`,
    });
  });

  return { freedSlot: row.slot, effectiveHumanity: character.humanity };
}

/**
 * List a character's installed chrome with the effective bonuses computed by
 * the game logic (stat deltas, HP, gig success) and the total humanity spent.
 */
export async function listInstalledChrome(characterId: string): Promise<InstalledChromeResponse> {
  const [character] = await db("characters")
    .select("humanity")
    .where("id", characterId)
    .limit(1);
  if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

  const rows = await db("installed_chrome")
    .select(
      "installed_chrome.id as installedId",
      "installed_chrome.installed_at as installedAt",
      "chrome_definitions.*",
    )
    .join("chrome_definitions", "installed_chrome.chrome_definition_id", "=", "chrome_definitions.id")
    .where("installed_chrome.character_id", characterId)
    .orderBy("installed_chrome.installed_at");

  // The join output mixes installed_chrome fields with chrome_definitions.*.
  // The definition columns come back as-is (snake_case); installed metadata
  // is aliased. Map rows: split out installed metadata from the definition.
  const definitions: ChromeDefinition[] = [];
  const installed: InstalledChromeRecord[] = [];

  for (const row of rows) {
    const def: DbChromeDefinition = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      slot: row.slot,
      tier: row.tier,
      bonuses: row.bonuses,
      humanity_cost: row.humanity_cost,
      base_price: row.base_price,
      description: row.description,
      is_active: row.is_active,
    };
    definitions.push(toPublicDefinition(def));
    installed.push({
      installedId: row.installedId,
      installedAt: new Date(row.installedAt).toISOString(),
      definition: toPublicDefinition(def),
    });
  }

  return {
    installed,
    effectiveHumanity: character.humanity,
    humanitySpent: calculateHumanityCost(definitions),
    statBonus: calculateStatBonus(definitions),
    hpBonus: calculateHpBonus(definitions),
    gigSuccessBonus: calculateGigSuccessBonus(definitions),
    nilMaxBonus: calculateNilMaxBonus(definitions),
  };
}

/**
 * List the active chrome catalog, optionally filtered by tier and/or slot.
 */
export async function listChromeCatalog(filters?: {
  tier?: number;
  slot?: ChromeSlot;
}): Promise<ChromeDefinition[]> {
  let query = db("chrome_definitions")
    .select()
    .where("is_active", true);

  if (filters?.tier !== undefined) query = query.where("tier", filters.tier);
  if (filters?.slot !== undefined) query = query.where("slot", filters.slot);

  const rows = await query.orderBy("tier").orderBy("name");
  return rows.map(toPublicDefinition);
}
