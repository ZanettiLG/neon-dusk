import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { desc, sql } from "drizzle-orm";

// Neon Dusk — Database Schema
// ============================================================================
// Feature #1: users + characters (account & character creation).
// Feature #2: NIL columns on characters (energy + passive regen).
// Drizzle tracks applied migrations automatically via the
// `__drizzle_migrations` table. No manual tracking table needed.

// --- Enums -------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["solo", "netrunner", "tech", "fixer", "nomad"]);

export const originEnum = pgEnum("origin", [
  "a_paraiso",
  "o_fervo",
  "o_fluxo",
  "a_quebrada",
  "babilonia",
  "as_mortas",
  "o_ponto",
]);

// Feature #3 (ND-010): Economy. Transaction types record every wallet movement;
// vendor types classify the NPC vendors that sell gear and consumables.
export const transactionTypeEnum = pgEnum("transaction_type", [
  "GIG_PAYOUT",
  "VENDOR_PURCHASE",
  "PVP_REWARD",
  "PVP_LOSS",
  "STIM_PURCHASE",
  "CREW_BONUS",
  "ADMIN_ADJUSTMENT",
]);

export const vendorTypeEnum = pgEnum("vendor_type", [
  "RIPPERDOC",
  "STIM_DEALER",
  "FIXER",
  "BLACK_MARKET",
]);

// --- Tables ------------------------------------------------------------------

export const health = pgTable("health", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
  healthy: boolean("healthy").notNull().default(true),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Case-insensitive unique email (functional index on lower(email)).
    uniqueIndex("users_email_lower_idx").on(sql`lower(${table.email})`),
  ],
);

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    origin: originEnum("origin").notNull(),
    role: roleEnum("role").notNull(),
    body: integer("body").notNull().default(3),
    reflexes: integer("reflexes").notNull().default(3),
    intelligence: integer("intelligence").notNull().default(3),
    technical: integer("technical").notNull().default(3),
    cool: integer("cool").notNull().default(3),
    // NIL (Feature #2): neural load — regens +1 every 5 min. `nil_updated_at`
    // is the last persisted snapshot; regen is applied lazily on read.
    nil: integer("nil").notNull().default(100),
    maxNil: integer("max_nil").notNull().default(100),
    nilUpdatedAt: timestamp("nil_updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Case-insensitive unique name (functional index on lower(name)).
    uniqueIndex("characters_name_lower_idx").on(sql`lower(${table.name})`),
    // Attributes: each 1..20, total must be exactly 22 (3 base × 5 + 7 free).
    check("characters_body_range", sql`${table.body} between 1 and 20`),
    check("characters_reflexes_range", sql`${table.reflexes} between 1 and 20`),
    check("characters_intelligence_range", sql`${table.intelligence} between 1 and 20`),
    check("characters_technical_range", sql`${table.technical} between 1 and 20`),
    check("characters_cool_range", sql`${table.cool} between 1 and 20`),
    check(
      "characters_attrs_total",
      sql`${table.body} + ${table.reflexes} + ${table.intelligence} + ${table.technical} + ${table.cool} = 22`,
    ),
    // NIL integrity: never negative, never above max, max always positive.
    check("characters_nil_range", sql`${table.nil} >= 0 and ${table.nil} <= ${table.maxNil}`),
    check("characters_max_nil_positive", sql`${table.maxNil} > 0`),
  ],
);

// --- Economy (Feature #3 / ND-010) ------------------------------------------
// Character wallets hold eddies; every movement is audited in transaction_log
// and guarded by DB CHECK constraints as the last line of defense. `version`
// enables optimistic locking — writes compare-and-swap on it.

export const characterWallets = pgTable(
  "character_wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .unique()
      .references(() => characters.id, { onDelete: "cascade" }),
    balance: bigint("balance", { mode: "number" }).notNull().default(0),
    escrow: bigint("escrow", { mode: "number" }).notNull().default(0),
    lifetimeEarned: bigint("lifetime_earned", { mode: "number" }).notNull().default(0),
    lifetimeSpent: bigint("lifetime_spent", { mode: "number" }).notNull().default(0),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("character_wallets_balance_non_negative", sql`${table.balance} >= 0`),
    check("character_wallets_escrow_non_negative", sql`${table.escrow} >= 0`),
    check("character_wallets_escrow_lte_balance", sql`${table.escrow} <= ${table.balance}`),
    check("character_wallets_lifetime_earned_non_negative", sql`${table.lifetimeEarned} >= 0`),
    check("character_wallets_lifetime_spent_non_negative", sql`${table.lifetimeSpent} >= 0`),
  ],
);

// Append-only audit trail. The CHECK constraint guarantees every row is an
// internally consistent balance delta (after - before = amount).
export const transactionLog = pgTable(
  "transaction_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    type: transactionTypeEnum("type").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    balanceBefore: bigint("balance_before", { mode: "number" }).notNull(),
    balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
    source: text("source").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "transaction_log_balance_check",
      sql`${table.balanceAfter} - ${table.balanceBefore} = ${table.amount}`,
    ),
    // History queries: per-character page scans + per-type filtering.
    index("idx_transaction_log_character_id").on(table.characterId, desc(table.createdAt)),
    index("idx_transaction_log_type").on(table.type),
  ],
);

export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: vendorTypeEnum("type").notNull(),
  district: text("district").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vendorInventory = pgTable(
  "vendor_inventory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(),
    itemId: text("item_id").notNull(),
    price: bigint("price", { mode: "number" }).notNull(),
    stock: integer("stock").notNull().default(-1), // -1 = unlimited
  },
  (table) => [
    uniqueIndex("vendor_inventory_unique_item").on(table.vendorId, table.itemType, table.itemId),
    check("vendor_inventory_price_positive", sql`${table.price} > 0`),
  ],
);

export const lootTables = pgTable(
  "loot_tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gigTier: text("gig_tier").notNull(),
    itemType: text("item_type").notNull(),
    itemId: text("item_id").notNull(),
    weight: real("weight").notNull(),
    minQuantity: integer("min_quantity").notNull().default(1),
    maxQuantity: integer("max_quantity").notNull().default(1),
  },
  (table) => [
    check("loot_tables_weight_positive", sql`${table.weight} > 0`),
    check(
      "loot_tables_quantity_range",
      sql`${table.minQuantity} >= 1 AND ${table.maxQuantity} >= ${table.minQuantity}`,
    ),
  ],
);
