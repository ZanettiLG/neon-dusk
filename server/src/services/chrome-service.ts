import type {
  ChromeDefinition,
  ChromeInstallResponse,
  ChromeSlot,
  ChromeUninstallResponse,
  InstalledChromeRecord,
  InstalledChromeResponse,
  Role,
} from "@neon-dusk/shared";
import { SLOT_CAPACITY, NIL_MAX_BASE } from "@neon-dusk/shared";
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
import { withTransaction } from "../db";
import { characterRepository as characters } from "../repositories/character-repository";
import { walletRepository as wallets } from "../repositories/wallet-repository";
import { transactionRepository as transactions } from "../repositories/transaction-repository";
import { chromeRepository as chrome } from "../repositories/chrome-repository";
import { getOsStatus } from "./os-service";
import type {
  ChromeDefinitionRow,
  InstalledChromeRow,
} from "../repositories/chrome-repository";

// Neon Dusk — Cromo service (install / uninstall / loadout / catalog)
// ============================================================================
// Install is a single PostgreSQL transaction: vendor stock check → wallet
// debit (optimistic lock, same pattern as buyFromVendor) → audit entry →
// implant insert → atomic humanity decrement. The UPDATE's WHERE guard
// (`humanity >= cost`) re-validates the cost against the row's current
// humanity at write time, so concurrent installs that both read the same
// value can never overwrite each other's deduction. When the decrement
// drains humanity to 0, the same transaction marks the character as
// flatlined (issue #28) — the install path is the flatline trigger.

/** DB row → API shape (snake → camel; strips is_active internals). */
function toPublicDefinition(row: ChromeDefinitionRow): ChromeDefinition {
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

/**
 * Install cromo bought from a ferrageiro. Validates the implant, the vendor
 * stock, the slot capacity and the humanity cost, then atomically debits the
 * wallet and records the implant + audit entry. When the humanity cost
 * drains the character to exactly 0, the same transaction marks them as
 * flatlined (apagado — permanent for the round). Returns the new loadout
 * entry, the effective humanity and the post-purchase wallet balance.
 */
export async function installChrome(
  characterId: string,
  chromeDefinitionId: string,
  vendorId: string,
): Promise<ChromeInstallResponse> {
  // 1. Cromo definition must exist and be active
  const definition = await chrome.findDefinition(chromeDefinitionId);
  if (!definition) throw new AppError(404, "CHROME_NOT_FOUND", "Cromo não encontrado");

  // 2. Vendor must stock this chrome (item_type='CHROME', item_id=slug)
  const stockItem = await chrome.findStockItem(vendorId, definition.slug);
  if (!stockItem) {
    throw new AppError(404, "ITEM_NOT_FOUND", "Este ferrageiro não tem esse cromo em estoque");
  }

  return withTransaction(async (trx) => {
    // 3. Character — humanity read fresh inside the tx (it guards the write)
    const character = await characters.findById(characterId, trx);
    if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

    // Issue #28: flatline enforcement — an Apagado character cannot install
    // cromo (flag 1 approved: permanent loss, consumables are the only net).
    if (character.is_flatlined) {
      throw new AppError(403, "FLATLINED", "Personagem apagado. Sem ações permitidas.");
    }

    // Feature #65: Overclock — 50% discount + 0 humanity cost for gambiarristas.
    const overclockActive = getOverclockBonus(
      character.role as Role,
      character.ability_active_until,
      character.ability_cooldown_until,
    );

    // 4. Current loadout — duplicate check + per-slot count
    const loadout = await chrome.listInstalled(characterId, trx);

    if (loadout.some((row) => row.definitionId === chromeDefinitionId)) {
      throw new AppError(409, "ALREADY_INSTALLED", "Cromo já instalado");
    }

    // Issue #28: one OS per round — the operating_system slot is exclusive
    // and permanent; a second OS install is rejected.
    if (definition.slot === "operating_system") {
      const osInstalled = loadout.some((row) => row.slot === "operating_system");
      if (osInstalled) {
        throw new AppError(409, "OS_ALREADY_INSTALLED", "Você já tem um SO instalado nesta rodada.");
      }
    }

    // 5. Slot capacity (one definition per install, so counts never double)
    const installedInSlot = loadout.filter((row) => row.slot === definition.slot).length;
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
      throw new AppError(400, "HUMANITY_TOO_LOW", "Humanidade insuficiente para instalar este cromo");
    }

    // 7. Wallet debit with optimistic locking (pattern of buyFromVendor)
    const wallet = await wallets.ensure(characterId, trx);
    // overclock: 50% discount on cromo price
    const price = overclockActive ? Math.ceil(stockItem.price * 0.5) : stockItem.price;
    const availableFunds = wallet.balance - wallet.escrow;
    if (availableFunds < price) {
      throw new AppError(400, "INSUFFICIENT_FUNDS", `Precisa de G$ ${price} disponível, tem G$ ${availableFunds}.`);
    }

    const result = transferEddies(wallet, -price, {
      type: "CHROME_PURCHASE",
      source: `Purchased ${definition.name} (${definition.slug}) from vendor ${vendorId}`,
      referenceType: "chrome_definition",
      referenceId: definition.id,
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

    // Audit entry
    await transactions.insert(
      {
        character_id: characterId,
        type: "CHROME_PURCHASE",
        amount: -price,
        balance_before: result.transaction.balanceBefore,
        balance_after: result.transaction.balanceAfter,
        source: result.transaction.source,
        reference_type: "chrome_definition",
        reference_id: definition.id,
      },
      trx,
    );

    // Implant record — unique(character, definition) violations map to
    // ALREADY_INSTALLED inside the repository.
    const installed: InstalledChromeRow = await chrome.insertInstalled(
      characterId,
      definition.id,
      trx,
    );

    // Issue #28: an OS install mirrors the definition into os_ability_id
    // (the OS activation state lives on characters — ADR 1).
    if (definition.slot === "operating_system") {
      await characters.setOsAbilityId(characterId, definition.id, trx);
    }

    // Atomic humanity decrement — zero when overclock is active.
    const effectiveHumanity = character.humanity - effectiveHumanityCost;
    if (effectiveHumanityCost > 0) {
      await characters.updateHumanityGuarded(characterId, effectiveHumanity, effectiveHumanityCost, trx);
    }

    // Issue #28: flatline trigger — an install that drains humanity to 0
    // apaga the character PERMANENTLY for the round (flag 1 approved: no
    // restore path exists; therapy/consumables are blocked by the 403 gates).
    // Same transaction as the humanity decrement — no window where a
    // zero-humanity character is still actionable.
    if (effectiveHumanity <= 0) {
      await characters.updateFlatline(characterId, trx);
    }

    // Feature #65: consume Overclock after successful install.
    if (overclockActive) {
      const consumed = computeConsumption(character.role as Role);
      await characters.updateAbilityState(
        characterId,
        { activeUntil: consumed.activeUntil, cooldownUntil: consumed.cooldownUntil },
        trx,
      );
    }

    // Recompute effective NIL max from all installed cromo (base 100 + nil_max bonuses).
    const installedDefs = await chrome.listInstalledBonuses(characterId, trx);
    const nilMaxBonus = calculateNilMaxBonus(
      installedDefs.map((d) => ({ bonuses: d.bonuses }) as unknown as ChromeDefinition),
    );
    await characters.updateMaxNil(characterId, NIL_MAX_BASE + nilMaxBonus, trx);

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
 * Remove um implante instalado. Sem reembolso de grana e sem recuperação de
 * humanidade — apenas um registro de auditoria (valor 0, então o CHECK de
 * saldo continua valendo). Retorna o slot liberado e a humanidade efetiva
 * inalterada.
 */
export async function uninstallChrome(
  characterId: string,
  installedChromeId: string,
): Promise<ChromeUninstallResponse> {
  // Load the implant joined with its definition; scoping by characterId makes
  // a foreign id indistinguishable from a missing one (404 either way).
  const row = await chrome.findInstalledById(installedChromeId, characterId);
  if (!row) throw new AppError(404, "INSTALLED_CHROME_NOT_FOUND", "Cromo instalado não encontrado");

  // Issue #28: the OS is permanent for the round — removal only via reset.
  if (row.slot === "operating_system") {
    throw new AppError(400, "OS_PERMANENT", "O SO é permanente por rodada. Troque no reset.");
  }

  const character = await characters.findById(characterId);
  if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

  await withTransaction(async (trx) => {
    await chrome.deleteInstalled(installedChromeId, trx);

    // Recompute effective NIL max from remaining chrome.
    const remaining = await chrome.listInstalledBonuses(characterId, trx);
    const nilMaxBonus = calculateNilMaxBonus(
      remaining.map((d) => ({ bonuses: d.bonuses }) as unknown as ChromeDefinition),
    );
    await characters.updateMaxNil(characterId, NIL_MAX_BASE + nilMaxBonus, trx);

    // Audit-only entry: no wallet movement, so balanceBefore = balanceAfter.
    const wallet = await wallets.ensure(characterId, trx);
    await transactions.insert(
      {
        character_id: characterId,
        type: "CHROME_UNINSTALL",
        amount: 0,
        balance_before: wallet.balance,
        balance_after: wallet.balance,
        source: `Uninstalled ${row.name}`,
      },
      trx,
    );
  });

  return { freedSlot: row.slot as ChromeSlot, effectiveHumanity: character.humanity };
}

/**
 * List a character's installed cromo with the effective bonuses computed by
 * the game logic (stat deltas, HP, trampo success) and the total humanity spent.
 */
export async function listInstalledChrome(characterId: string): Promise<InstalledChromeResponse> {
  const character = await characters.findById(characterId);
  if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

  const rows = await chrome.listInstalledFull(characterId);

  // The join output mixes installed_chrome fields with chrome_definitions.*.
  // The definition columns come back as-is (snake_case); installed metadata
  // is aliased. Map rows: split out installed metadata from the definition.
  const definitions: ChromeDefinition[] = [];
  const installed: InstalledChromeRecord[] = [];

  for (const row of rows) {
    const def: ChromeDefinitionRow = {
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
      created_at: row.created_at,
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
    // Issue #28: installed OS activation readout (null-safe read).
    osAbility: await getOsStatus(characterId),
  };
}

/**
 * List the active cromo catalog, optionally filtered by tier and/or slot.
 */
export async function listChromeCatalog(filters?: {
  tier?: number;
  slot?: ChromeSlot;
}): Promise<ChromeDefinition[]> {
  const rows = await chrome.listCatalog(filters);
  return rows.map(toPublicDefinition);
}
