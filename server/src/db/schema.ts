import { boolean, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

// Neon Dusk — Database Schema
// ============================================================================
// Bootstrap placeholder so `drizzle-kit generate` produces an initial migration.
// Feature developers: add real tables here (or in sibling files re-exported
// from this barrel), then run `npm run db:generate`.
//
// Drizzle tracks applied migrations automatically via the
// `__drizzle_migrations` table. No manual tracking table needed.

export const health = pgTable("health", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
  healthy: boolean("healthy").notNull().default(true),
});
