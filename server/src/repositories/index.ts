import { db, type Queryable } from "../db";
import { createUserRepository, type UserRepository } from "./user-repository";
import {
  createCharacterRepository,
  type CharacterRepository,
} from "./character-repository";
import { createWalletRepository, type WalletRepository } from "./wallet-repository";
import {
  createTransactionRepository,
  type TransactionRepository,
} from "./transaction-repository";
import { createVendorRepository, type VendorRepository } from "./vendor-repository";
import { createLootRepository, type LootRepository } from "./loot-repository";
import {
  createGameEventRepository,
  type GameEventRepository,
} from "./game-event-repository";
import { createChromeRepository, type ChromeRepository } from "./chrome-repository";
import { createGigRepository, type GigRepository } from "./gig-repository";
import { createHeatRepository, type HeatRepository } from "./heat-repository";
import { createPvpRepository, type PvpRepository } from "./pvp-repository";
import { createLegendRepository, type LegendRepository } from "./legend-repository";
import { createCrewRepository, type CrewRepository } from "./crew-repository";
import { createRoundRepository, type RoundRepository } from "./round-repository";
import { createAuditRepository, type AuditRepository } from "./audit-repository";
import {
  createGameParamRepository,
  type GameParamRepository,
} from "./game-param-repository";
import {
  createConsumableRepository,
  type ConsumableRepository,
} from "./consumable-repository";
import {
  createTherapyRepository,
  type TherapyRepository,
} from "./therapy-repository";

// Neon Dusk — Repositories barrel (#158 DB repository layer)
// ============================================================================
// Single entry point for every repository. `createRepositories(q)` builds a
// full set against a specific Queryable (db or a transaction); `repositories`
// is the shared production singleton against the global db.
//
// Production code imports from here (or the per-table modules) instead of
// touching the db client directly.

/** Every repository in one bundle. */
export interface Repositories {
  users: UserRepository;
  characters: CharacterRepository;
  wallets: WalletRepository;
  transactions: TransactionRepository;
  vendors: VendorRepository;
  loot: LootRepository;
  gameEvents: GameEventRepository;
  chrome: ChromeRepository;
  gigs: GigRepository;
  heat: HeatRepository;
  pvp: PvpRepository;
  legends: LegendRepository;
  crews: CrewRepository;
  rounds: RoundRepository;
  audit: AuditRepository;
  gameParams: GameParamRepository;
  consumables: ConsumableRepository;
  therapy: TherapyRepository;
}

/**
 * Build a repository set bound to `q` (the global db by default). Pass a
 * Knex transaction to run repository methods inside that transaction.
 */
export function createRepositories(q: Queryable = db): Repositories {
  return {
    users: createUserRepository(q),
    characters: createCharacterRepository(q),
    wallets: createWalletRepository(q),
    transactions: createTransactionRepository(q),
    vendors: createVendorRepository(q),
    loot: createLootRepository(q),
    gameEvents: createGameEventRepository(q),
    chrome: createChromeRepository(q),
    gigs: createGigRepository(q),
    heat: createHeatRepository(q),
    pvp: createPvpRepository(q),
    legends: createLegendRepository(q),
    crews: createCrewRepository(q),
    rounds: createRoundRepository(q),
    audit: createAuditRepository(q),
    gameParams: createGameParamRepository(q),
    consumables: createConsumableRepository(q),
    therapy: createTherapyRepository(q),
  };
}

/** Shared production singleton (bound to the global db). */
export const repositories = createRepositories();

/** Re-export the Queryable type so production code can type its helpers. */
export type { Queryable } from "../db";
