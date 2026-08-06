import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Neon Dusk — Database Schema
// ============================================================================
// Feature #1: users + characters (account & character creation).
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
  ],
);
