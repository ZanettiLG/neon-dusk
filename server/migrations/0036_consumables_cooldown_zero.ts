import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0036: consumables cooldown zero (#187)
 * ============================================================================
 * Cooldown tuning: per-item cooldowns (T2 12h, T3 24h) removed — the stock
 * (purchased inventory) and the rolling-24h use window are the limiters now.
 * Existing rows get cooldown_hours = 0 (0 = none; the mechanism in
 * game/consumables.ts still supports re-enabling via seeds).
 */

export async function up(knex: Knex): Promise<void> {
  await knex("consumables").update({ cooldown_hours: 0 });
}

export async function down(knex: Knex): Promise<void> {
  // Restore the pre-#187 values by slug (T1 none, T2 12h, T3 24h).
  await knex("consumables").where({ slug: "freio" }).update({ cooldown_hours: 12 });
  await knex("consumables").where({ slug: "choque" }).update({ cooldown_hours: 24 });
}
