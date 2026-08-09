import type { Knex } from "knex";

/**
 * Neon Dusk — Consolidated Initial Schema
 * ============================================================================
 * Single migration that creates ALL tables, enums, constraints, indexes, triggers
 * and seed data from migrations 0000–0017.
 *
 * Run: `npx knex migrate:latest --knexfile knexfile.ts`
 * Rollback: `npx knex migrate:rollback --knexfile knexfile.ts`
 */

export async function up(knex: Knex): Promise<void> {
  // ═══════════════════════════════════════════════════════════════════════
  // 1. ENUMS
  // ═══════════════════════════════════════════════════════════════════════

  await knex.raw(`CREATE TYPE "role" AS ENUM('solo', 'netrunner', 'tech', 'fixer', 'nomad')`);
  await knex.raw(
    `CREATE TYPE "origin" AS ENUM('a_paraiso', 'o_fervo', 'o_fluxo', 'a_quebrada', 'babilonia', 'as_mortas', 'o_ponto')`,
  );
  await knex.raw(`CREATE TYPE "user_role" AS ENUM('player', 'admin')`);
  await knex.raw(
    `CREATE TYPE "transaction_type" AS ENUM('GIG_PAYOUT', 'VENDOR_PURCHASE', 'PVP_REWARD', 'PVP_LOSS', 'STIM_PURCHASE', 'CREW_BONUS', 'ADMIN_ADJUSTMENT', 'CHROME_PURCHASE', 'CHROME_UNINSTALL', 'STREET_CRED_AWARD', 'CREW_CREATION')`,
  );
  await knex.raw(
    `CREATE TYPE "vendor_type" AS ENUM('RIPPERDOC', 'STIM_DEALER', 'FIXER', 'BLACK_MARKET')`,
  );
  await knex.raw(
    `CREATE TYPE "game_event_type" AS ENUM('CHARACTER_CREATED', 'GIG_STARTED', 'GIG_COMPLETED', 'GIG_FAILED', 'PVP_ATTACK', 'PVP_DEFEAT', 'EDDIES_EARNED', 'EDDIES_SPENT', 'NIL_SPENT', 'NIL_RESTORED', 'VENDOR_PURCHASE', 'ABILITY_ACTIVATED', 'ABILITY_CONSUMED')`,
  );
  await knex.raw(`CREATE TYPE "gig_type" AS ENUM('extraction', 'delivery', 'sabotage')`);
  await knex.raw(`CREATE TYPE "gig_tier" AS ENUM('t1', 't2', 't3', 't4', 't5')`);
  await knex.raw(
    `CREATE TYPE "gig_phase" AS ENUM('meet', 'legwork', 'execute', 'escape', 'wrap_up')`,
  );
  await knex.raw(`CREATE TYPE "gig_outcome" AS ENUM('success', 'failure')`);
  await knex.raw(
    `CREATE TYPE "history_outcome" AS ENUM('success', 'failure', 'abandoned')`,
  );
  await knex.raw(
    `CREATE TYPE "chrome_slot" AS ENUM('frontal_cortex', 'ocular', 'arms', 'skeleton', 'nervous_system', 'integumentary')`,
  );
  await knex.raw(`CREATE TYPE "round_status" AS ENUM('active', 'ended')`);
  await knex.raw(
    `CREATE TYPE "audit_result" AS ENUM('allowed', 'blocked', 'rate_limited', 'validation_error', 'circuit_break', 'cooldown_active', 'server_error')`,
  );

  // ═══════════════════════════════════════════════════════════════════════
  // 2. TABLES (FK-light first, then tables with cross-dependencies)
  // ═══════════════════════════════════════════════════════════════════════

  // --- health -----------------------------------------------------------------
  await knex.schema.createTable("health", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.timestamp("checked_at").defaultTo(knex.fn.now()).notNullable();
    table.boolean("healthy").defaultTo(true).notNullable();
  });

  // --- users ------------------------------------------------------------------
  await knex.schema.createTable("users", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("email").notNullable();
    table.text("password_hash").notNullable();
    table.specificType("role", "public.user_role").notNullable().defaultTo("player");
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.timestamp("updated_at").defaultTo(knex.fn.now()).notNullable();
  });

  // --- characters (crew_id added later after crews table exists) ---------------
  await knex.schema.createTable("characters", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("user_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("users")
      .onDelete("cascade");
    table.text("name").notNullable();
    table.specificType("origin", "public.origin").notNullable();
    table.specificType("role", "public.role").notNullable();
    table.integer("body").notNullable().defaultTo(3);
    table.integer("reflexes").notNullable().defaultTo(3);
    table.integer("intelligence").notNullable().defaultTo(3);
    table.integer("technical").notNullable().defaultTo(3);
    table.integer("cool").notNullable().defaultTo(3);
    table.integer("street_cred").notNullable().defaultTo(0);
    table.integer("max_street_cred_achieved").notNullable().defaultTo(0);
    table
      .specificType("last_activity_at", "timestamptz")
      .notNullable()
      .defaultTo(knex.fn.now());
    table.integer("nil").notNullable().defaultTo(100);
    table.integer("max_nil").notNullable().defaultTo(100);
    table.timestamp("nil_updated_at").notNullable().defaultTo(knex.fn.now());
    table.integer("humanity").notNullable().defaultTo(100);
    table.boolean("is_banned").notNullable().defaultTo(false);
    table.specificType("ability_active_until", "timestamptz");
    table.specificType("ability_cooldown_until", "timestamptz");
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.timestamp("updated_at").defaultTo(knex.fn.now()).notNullable();
  });

  // --- character_wallets -------------------------------------------------------
  await knex.schema.createTable("character_wallets", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table.bigint("balance").notNullable().defaultTo(0);
    table.bigint("escrow").notNullable().defaultTo(0);
    table.bigint("lifetime_earned").notNullable().defaultTo(0);
    table.bigint("lifetime_spent").notNullable().defaultTo(0);
    table.integer("version").notNullable().defaultTo(0);
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.timestamp("updated_at").defaultTo(knex.fn.now()).notNullable();
  });

  // --- transaction_log ---------------------------------------------------------
  await knex.schema.createTable("transaction_log", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table.specificType("type", "public.transaction_type").notNullable();
    table.bigint("amount").notNullable();
    table.bigint("balance_before").notNullable();
    table.bigint("balance_after").notNullable();
    table.text("source").notNullable();
    table.text("reference_type");
    table.uuid("reference_id");
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });

  // --- vendors -----------------------------------------------------------------
  await knex.schema.createTable("vendors", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("name").notNullable();
    table.specificType("type", "public.vendor_type").notNullable();
    table.text("district").notNullable();
    table.text("description");
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });

  // --- vendor_inventory --------------------------------------------------------
  await knex.schema.createTable("vendor_inventory", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("vendor_id")
      .notNullable()
      .references("id")
      .inTable("vendors")
      .onDelete("cascade");
    table.text("item_type").notNullable();
    table.text("item_id").notNullable();
    table.bigint("price").notNullable();
    table.integer("stock").notNullable().defaultTo(-1);
  });

  // --- loot_tables -------------------------------------------------------------
  await knex.schema.createTable("loot_tables", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("gig_tier").notNullable();
    table.text("item_type").notNullable();
    table.text("item_id").notNullable();
    table.specificType("weight", "real").notNullable();
    table.integer("min_quantity").notNullable().defaultTo(1);
    table.integer("max_quantity").notNullable().defaultTo(1);
  });

  // --- game_events -------------------------------------------------------------
  await knex.schema.createTable("game_events", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.specificType("event_type", "public.game_event_type").notNullable();
    table.uuid("actor_id"); // FK-less — never blocks deletion
    table
      .jsonb("payload")
      .notNullable()
      .defaultTo(knex.raw("'{}'::jsonb"));
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });

  // --- chrome_definitions ------------------------------------------------------
  await knex.schema.createTable("chrome_definitions", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("slug").notNullable().unique();
    table.text("name").notNullable();
    table.specificType("slot", "public.chrome_slot").notNullable();
    table.integer("tier").notNullable();
    table
      .jsonb("bonuses")
      .notNullable()
      .defaultTo(knex.raw("'{}'::jsonb"));
    table.integer("humanity_cost").notNullable();
    table.bigint("base_price").notNullable();
    table.text("description");
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });

  // --- installed_chrome --------------------------------------------------------
  await knex.schema.createTable("installed_chrome", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .uuid("chrome_definition_id")
      .notNullable()
      .references("id")
      .inTable("chrome_definitions")
      .onDelete("restrict");
    table.timestamp("installed_at").defaultTo(knex.fn.now()).notNullable();
  });

  // --- gigs --------------------------------------------------------------------
  await knex.schema.createTable("gigs", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("name").notNullable().unique();
    table.text("description").notNullable();
    table.specificType("tier", "public.gig_tier").notNullable();
    table.specificType("type", "public.gig_type").notNullable();
    table.text("district").notNullable();
    table.integer("difficulty").notNullable();
    table.integer("escape_difficulty").notNullable().defaultTo(40);
    table.jsonb("required_stats").notNullable();
    table.integer("required_street_cred").notNullable().defaultTo(0);
    table.integer("base_reward").notNullable();
    table.integer("nil_cost").notNullable();
    table.integer("heat_generated").notNullable().defaultTo(5);
    table.integer("legwork_minutes").notNullable();
    table.integer("cooldown_minutes").notNullable().defaultTo(10);
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });

  // --- active_gigs -------------------------------------------------------------
  await knex.schema.createTable("active_gigs", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .uuid("gig_id")
      .notNullable()
      .references("id")
      .inTable("gigs")
      .onDelete("restrict");
    table.specificType("phase", "public.gig_phase").notNullable().defaultTo("meet");
    table.text("status").notNullable().defaultTo("active");
    table.timestamp("accepted_at").defaultTo(knex.fn.now()).notNullable();
    table.timestamp("legwork_started_at");
    table.boolean("legwork_completed").notNullable().defaultTo(false);
    table.specificType("execute_outcome", "public.gig_outcome");
    table.specificType("escape_outcome", "public.gig_outcome");
    table.integer("actual_payout");
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.timestamp("updated_at").defaultTo(knex.fn.now()).notNullable();
  });

  // --- gig_history -------------------------------------------------------------
  await knex.schema.createTable("gig_history", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .uuid("gig_id")
      .notNullable()
      .references("id")
      .inTable("gigs")
      .onDelete("restrict");
    table.specificType("outcome", "public.history_outcome").notNullable();
    table.specificType("phases_completed", "text[]").notNullable();
    table.integer("payout").notNullable().defaultTo(0);
    table.integer("street_cred_gained").notNullable().defaultTo(0);
    table.integer("heat_accumulated").notNullable().defaultTo(0);
    table.text("district").notNullable();
    table.timestamp("completed_at").defaultTo(knex.fn.now()).notNullable();
  });

  // --- heat --------------------------------------------------------------------
  await knex.schema.createTable("heat", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table.text("district").notNullable();
    table.integer("amount").notNullable().defaultTo(0);
    table.timestamp("updated_at").defaultTo(knex.fn.now()).notNullable();
  });

  // --- pvp_combats -------------------------------------------------------------
  await knex.schema.createTable("pvp_combats", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("attacker_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .uuid("defender_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table.integer("attacker_power").notNullable();
    table.integer("defender_power").notNullable();
    table.uuid("winner_id").notNullable();
    table.integer("loot_amount").notNullable().defaultTo(0);
    table.boolean("griefer_penalty").notNullable().defaultTo(false);
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  // --- legends -----------------------------------------------------------------
  await knex.schema.createTable("legends", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("character_name").notNullable();
    table.text("drink_name").notNullable();
    table
      .specificType("achieved_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
    table.text("crew_name");
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  // --- crews -------------------------------------------------------------------
  await knex.schema.createTable("crews", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("name").notNullable().unique();
    table.text("tag").notNullable().unique();
    table
      .uuid("leader_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  // --- characters.crew_id (circular FK — requires crews to exist) --------------
  await knex.schema.alterTable("characters", (table) => {
    table
      .uuid("crew_id")
      .references("id")
      .inTable("crews")
      .onDelete("set null");
  });

  // --- crew_members ------------------------------------------------------------
  await knex.schema.createTable("crew_members", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("crew_id")
      .notNullable()
      .references("id")
      .inTable("crews")
      .onDelete("cascade");
    table
      .uuid("character_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .specificType("joined_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  // --- crew_invites ------------------------------------------------------------
  await knex.schema.createTable("crew_invites", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("crew_id")
      .notNullable()
      .references("id")
      .inTable("crews")
      .onDelete("cascade");
    table
      .uuid("character_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .uuid("invited_by")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
    table.specificType("expires_at", "timestamptz").notNullable();
  });

  // --- rounds ------------------------------------------------------------------
  await knex.schema.createTable("rounds", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.integer("round_number").notNullable().unique();
    table
      .specificType("started_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
    table.specificType("ended_at", "timestamptz");
    table
      .specificType("status", "public.round_status")
      .notNullable()
      .defaultTo("active");
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  // --- round_stats -------------------------------------------------------------
  await knex.schema.createTable("round_stats", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("round_id")
      .notNullable()
      .references("id")
      .inTable("rounds")
      .onDelete("cascade");
    table.integer("total_gigs_completed").notNullable().defaultTo(0);
    table.bigint("total_eddies_earned").notNullable().defaultTo(0);
    table.integer("total_pvp_fights").notNullable().defaultTo(0);
    table.integer("total_active_characters").notNullable().defaultTo(0);
    table.uuid("top_crew_id");
    table.text("top_crew_name");
    table.uuid("top_sc_character_id");
    table.text("top_sc_character_name");
    table.integer("top_sc_value");
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  // --- audit_log ---------------------------------------------------------------
  await knex.schema.createTable("audit_log", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .references("id")
      .inTable("characters")
      .onDelete("set null");
    table.text("action").notNullable();
    table.text("ip").notNullable();
    table.text("user_agent").notNullable();
    table
      .jsonb("payload")
      .notNullable()
      .defaultTo(knex.raw("'{}'::jsonb"));
    table
      .specificType("result", "public.audit_result")
      .notNullable()
      .defaultTo("allowed");
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  // --- game_params -------------------------------------------------------------
  await knex.schema.createTable("game_params", (table) => {
    table.text("key").primary();
    table.text("value").notNullable();
    table.uuid("updated_by").references("id").inTable("users").onDelete("set null");
    table
      .specificType("updated_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. CHECK CONSTRAINTS (raw SQL — Knex check() is basic)
  // ═══════════════════════════════════════════════════════════════════════

  // --- characters --------------------------------------------------------------
  for (const attr of ["body", "reflexes", "intelligence", "technical", "cool"]) {
    await knex.raw(
      `ALTER TABLE "characters" ADD CONSTRAINT "characters_${attr}_range" CHECK ("${attr}" between 1 and 20)`,
    );
  }
  // NOTE: characters_attrs_total (=22) is deliberately NOT included (ADR-1:
  // post-reset attributes return to base 3 each = sum 15).

  await knex.raw(
    `ALTER TABLE "characters" ADD CONSTRAINT "characters_nil_range" CHECK ("nil" >= 0 and "nil" <= "max_nil")`,
  );
  await knex.raw(
    `ALTER TABLE "characters" ADD CONSTRAINT "characters_max_nil_positive" CHECK ("max_nil" > 0)`,
  );
  await knex.raw(
    `ALTER TABLE "characters" ADD CONSTRAINT "characters_humanity_range" CHECK ("humanity" >= 0 and "humanity" <= 100)`,
  );
  await knex.raw(
    `ALTER TABLE "characters" ADD CONSTRAINT "characters_street_cred_range" CHECK ("street_cred" >= 0 AND "street_cred" <= 100)`,
  );
  await knex.raw(
    `ALTER TABLE "characters" ADD CONSTRAINT "characters_max_street_cred_range" CHECK ("max_street_cred_achieved" >= 0 AND "max_street_cred_achieved" <= 100)`,
  );

  // --- character_wallets -------------------------------------------------------
  await knex.raw(
    `ALTER TABLE "character_wallets" ADD CONSTRAINT "character_wallets_balance_non_negative" CHECK ("balance" >= 0)`,
  );
  await knex.raw(
    `ALTER TABLE "character_wallets" ADD CONSTRAINT "character_wallets_escrow_non_negative" CHECK ("escrow" >= 0)`,
  );
  await knex.raw(
    `ALTER TABLE "character_wallets" ADD CONSTRAINT "character_wallets_escrow_lte_balance" CHECK ("escrow" <= "balance")`,
  );
  await knex.raw(
    `ALTER TABLE "character_wallets" ADD CONSTRAINT "character_wallets_lifetime_earned_non_negative" CHECK ("lifetime_earned" >= 0)`,
  );
  await knex.raw(
    `ALTER TABLE "character_wallets" ADD CONSTRAINT "character_wallets_lifetime_spent_non_negative" CHECK ("lifetime_spent" >= 0)`,
  );

  // --- transaction_log ---------------------------------------------------------
  await knex.raw(
    `ALTER TABLE "transaction_log" ADD CONSTRAINT "transaction_log_balance_check" CHECK ("balance_after" - "balance_before" = "amount")`,
  );

  // --- vendor_inventory --------------------------------------------------------
  await knex.raw(
    `ALTER TABLE "vendor_inventory" ADD CONSTRAINT "vendor_inventory_price_positive" CHECK ("price" > 0)`,
  );

  // --- loot_tables -------------------------------------------------------------
  await knex.raw(
    `ALTER TABLE "loot_tables" ADD CONSTRAINT "loot_tables_weight_positive" CHECK ("weight" > 0)`,
  );
  await knex.raw(
    `ALTER TABLE "loot_tables" ADD CONSTRAINT "loot_tables_quantity_range" CHECK ("min_quantity" >= 1 AND "max_quantity" >= "min_quantity")`,
  );

  // --- chrome_definitions ------------------------------------------------------
  await knex.raw(
    `ALTER TABLE "chrome_definitions" ADD CONSTRAINT "chrome_definitions_tier_range" CHECK ("tier" between 1 and 5)`,
  );
  await knex.raw(
    `ALTER TABLE "chrome_definitions" ADD CONSTRAINT "chrome_definitions_humanity_cost_positive" CHECK ("humanity_cost" > 0)`,
  );
  await knex.raw(
    `ALTER TABLE "chrome_definitions" ADD CONSTRAINT "chrome_definitions_base_price_positive" CHECK ("base_price" > 0)`,
  );

  // --- gigs --------------------------------------------------------------------
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_difficulty_range" CHECK ("difficulty" BETWEEN 1 AND 100)`,
  );
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_escape_difficulty_range" CHECK ("escape_difficulty" BETWEEN 1 AND 100)`,
  );
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_base_reward_positive" CHECK ("base_reward" > 0)`,
  );
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_nil_cost_positive" CHECK ("nil_cost" > 0)`,
  );
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_heat_positive" CHECK ("heat_generated" >= 0)`,
  );
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_legwork_minutes_range" CHECK ("legwork_minutes" BETWEEN 5 AND 30)`,
  );
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_sc_non_negative" CHECK ("required_street_cred" >= 0)`,
  );

  // --- heat --------------------------------------------------------------------
  await knex.raw(
    `ALTER TABLE "heat" ADD CONSTRAINT "heat_amount_non_negative" CHECK ("amount" >= 0)`,
  );

  // --- pvp_combats -------------------------------------------------------------
  await knex.raw(
    `ALTER TABLE "pvp_combats" ADD CONSTRAINT "pvp_combats_loot_amount_non_negative" CHECK ("loot_amount" >= 0)`,
  );

  // --- crews -------------------------------------------------------------------
  await knex.raw(
    `ALTER TABLE "crews" ADD CONSTRAINT "crews_name_length" CHECK (char_length("name") BETWEEN 3 AND 20)`,
  );
  await knex.raw(
    `ALTER TABLE "crews" ADD CONSTRAINT "crews_tag_format" CHECK ("tag" ~ '^[A-Z0-9]{3}$')`,
  );

  // ═══════════════════════════════════════════════════════════════════════
  // 4. INDEXES (raw SQL for functional / partial / composite)
  // ═══════════════════════════════════════════════════════════════════════

  // Functional indexes (lower)
  await knex.raw(
    `CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" (lower("email"))`,
  );
  await knex.raw(
    `CREATE UNIQUE INDEX "characters_name_lower_idx" ON "characters" (lower("name"))`,
  );

  // Leaderboard (descending sort)
  await knex.raw(
    `CREATE INDEX "idx_characters_street_cred_desc" ON "characters" ("street_cred" DESC)`,
  );

  // Partial indexes
  await knex.raw(
    `CREATE INDEX "idx_characters_crew_id" ON "characters" ("crew_id") WHERE "crew_id" IS NOT NULL`,
  );
  await knex.raw(
    `CREATE INDEX "idx_characters_is_banned" ON "characters" ("is_banned") WHERE "is_banned" = true`,
  );

  // Transaction log
  await knex.raw(
    `CREATE INDEX "idx_transaction_log_character_id" ON "transaction_log" ("character_id", "created_at" DESC)`,
  );
  await knex.raw(
    `CREATE INDEX "idx_transaction_log_type" ON "transaction_log" ("type")`,
  );

  // Vendor inventory (composite unique)
  await knex.raw(
    `CREATE UNIQUE INDEX "vendor_inventory_unique_item" ON "vendor_inventory" ("vendor_id", "item_type", "item_id")`,
  );

  // Game events
  await knex.raw(
    `CREATE INDEX "idx_game_events_type_created_at" ON "game_events" ("event_type", "created_at" DESC)`,
  );

  // Installed chrome
  await knex.raw(
    `CREATE UNIQUE INDEX "installed_chrome_character_definition_unique" ON "installed_chrome" ("character_id", "chrome_definition_id")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_installed_chrome_character_id" ON "installed_chrome" ("character_id")`,
  );

  // Gigs
  await knex.raw(`CREATE INDEX "idx_gigs_tier" ON "gigs" ("tier")`);
  await knex.raw(`CREATE INDEX "idx_gigs_type" ON "gigs" ("type")`);
  await knex.raw(`CREATE INDEX "idx_gigs_district" ON "gigs" ("district")`);

  // Active gigs
  await knex.raw(
    `CREATE INDEX "idx_active_gigs_character" ON "active_gigs" ("character_id")`,
  );

  // Gig history
  await knex.raw(
    `CREATE INDEX "idx_gig_history_character" ON "gig_history" ("character_id", "completed_at" DESC)`,
  );
  await knex.raw(
    `CREATE INDEX "idx_gig_history_completed_at" ON "gig_history" ("completed_at")`,
  );

  // Heat
  await knex.raw(
    `CREATE UNIQUE INDEX "heat_character_district" ON "heat" ("character_id", "district")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_heat_character" ON "heat" ("character_id")`,
  );

  // PvP
  await knex.raw(
    `CREATE INDEX "idx_pvp_combats_attacker" ON "pvp_combats" ("attacker_id", "created_at" DESC)`,
  );
  await knex.raw(
    `CREATE INDEX "idx_pvp_combats_defender" ON "pvp_combats" ("defender_id", "created_at" DESC)`,
  );
  await knex.raw(
    `CREATE INDEX "idx_pvp_combats_attacker_defender" ON "pvp_combats" ("attacker_id", "defender_id", "created_at" DESC)`,
  );

  // Crews
  await knex.raw(
    `CREATE INDEX "idx_crew_members_crew_id" ON "crew_members" ("crew_id")`,
  );
  await knex.raw(
    `CREATE UNIQUE INDEX "crew_invites_crew_character_unique" ON "crew_invites" ("crew_id", "character_id")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_crew_invites_character_id" ON "crew_invites" ("character_id")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_crew_invites_crew_id" ON "crew_invites" ("crew_id")`,
  );

  // Rounds
  await knex.raw(`CREATE INDEX "idx_rounds_status" ON "rounds" ("status")`);
  await knex.raw(
    `CREATE UNIQUE INDEX "idx_rounds_active" ON "rounds" ("status") WHERE "status" = 'active'`,
  );

  // Round stats
  await knex.raw(
    `CREATE INDEX "idx_round_stats_round_id" ON "round_stats" ("round_id")`,
  );

  // Audit log
  await knex.raw(
    `CREATE INDEX "idx_audit_log_character" ON "audit_log" ("character_id")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_audit_log_action" ON "audit_log" ("action")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_audit_log_result" ON "audit_log" ("result")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_audit_log_created" ON "audit_log" ("created_at" DESC)`,
  );

  // ═══════════════════════════════════════════════════════════════════════
  // 5. TRIGGERS
  // ═══════════════════════════════════════════════════════════════════════

  await knex.raw(`
    CREATE OR REPLACE FUNCTION enforce_crew_member_limit()
    RETURNS TRIGGER AS $$
    BEGIN
        IF (SELECT COUNT(*) FROM "crew_members" WHERE "crew_id" = NEW."crew_id") >= 4 THEN
            RAISE EXCEPTION 'crew is full (max 4 members)';
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`
    CREATE TRIGGER "trg_crew_member_limit"
        BEFORE INSERT ON "crew_members"
        FOR EACH ROW
        EXECUTE FUNCTION enforce_crew_member_limit();
  `);

  // ═══════════════════════════════════════════════════════════════════════
  // 6. SEED DATA (was in old migrations: chrome, vendor, legends, rounds, params)
  // ═══════════════════════════════════════════════════════════════════════

  // --- 5 chrome definitions (migration 0004) ----------------------------------
  await knex("chrome_definitions").insert([
    {
      slug: "neural-booster",
      name: "Neural Booster",
      slot: "frontal_cortex",
      tier: 1,
      bonuses: { intelligence: 1, nil_max: 10 },
      humanity_cost: 3,
      base_price: 800,
      description:
        "Impulso neural que acelera o processamento cognitivo. +1 Inteligência.",
    },
    {
      slug: "reflex-tuner",
      name: "Reflex Tuner",
      slot: "nervous_system",
      tier: 1,
      bonuses: { reflexes: 1 },
      humanity_cost: 3,
      base_price: 800,
      description:
        "Ajuste de sinapses para reação quase instantânea. +1 Reflexos.",
    },
    {
      slug: "kiroshi-optics",
      name: "Kiroshi Optics",
      slot: "ocular",
      tier: 1,
      bonuses: { gig_success_rate: 2 },
      humanity_cost: 2,
      base_price: 900,
      description:
        "Óptica de combate Kiroshi com HUD tático. +2% de sucesso em gigs.",
    },
    {
      slug: "gorilla-arms",
      name: "Gorilla Arms",
      slot: "arms",
      tier: 2,
      bonuses: { body: 2 },
      humanity_cost: 6,
      base_price: 2500,
      description:
        "Braços cibernéticos de impacto pesado. +2 Corpo.",
    },
    {
      slug: "subdermal-armor",
      name: "Subdermal Armor",
      slot: "integumentary",
      tier: 2,
      bonuses: { max_hp: 15 },
      humanity_cost: 7,
      base_price: 2000,
      description:
        "Malha balística implantada sob a pele. +15 HP máximo.",
    },
  ]);

  // --- Doc Fios vendor + inventory (migration 0004) ---------------------------
  await knex("vendors").insert({
    id: "00000000-0000-4000-8000-000000000001",
    name: "Doc Fios",
    type: "RIPPERDOC",
    district: "babilonia",
    description:
      "Ripperdoc veterano da Babilônia. Mão firme — se você sobreviver à cirurgia, o chrome funciona.",
  });

  await knex("vendor_inventory").insert([
    {
      vendor_id: "00000000-0000-4000-8000-000000000001",
      item_type: "CHROME",
      item_id: "neural-booster",
      price: 800,
      stock: -1,
    },
    {
      vendor_id: "00000000-0000-4000-8000-000000000001",
      item_type: "CHROME",
      item_id: "reflex-tuner",
      price: 800,
      stock: -1,
    },
    {
      vendor_id: "00000000-0000-4000-8000-000000000001",
      item_type: "CHROME",
      item_id: "kiroshi-optics",
      price: 900,
      stock: -1,
    },
    {
      vendor_id: "00000000-0000-4000-8000-000000000001",
      item_type: "CHROME",
      item_id: "gorilla-arms",
      price: 2500,
      stock: -1,
    },
    {
      vendor_id: "00000000-0000-4000-8000-000000000001",
      item_type: "CHROME",
      item_id: "subdermal-armor",
      price: 2000,
      stock: -1,
    },
  ]);

  // --- 5 legends (migration 0009) ---------------------------------------------
  await knex("legends").insert([
    {
      character_name: "Razorback",
      drink_name: "Cromo no Gelo",
      achieved_at: "2085-03-15 02:47:00+00",
      crew_name: null,
    },
    {
      character_name: "Ghostwire",
      drink_name: "Flatline Azul",
      achieved_at: "2085-06-02 23:11:00+00",
      crew_name: null,
    },
    {
      character_name: "Dama de Paus",
      drink_name: "Sangue e Circuito",
      achieved_at: "2086-01-20 05:33:00+00",
      crew_name: "Os Sem Rosto",
    },
    {
      character_name: "Zé do Gatilho",
      drink_name: "O Último Gole",
      achieved_at: "2086-09-08 18:59:00+00",
      crew_name: null,
    },
    {
      character_name: "Mão Fria",
      drink_name: "Nevasca Elétrica",
      achieved_at: "2087-04-04 14:22:00+00",
      crew_name: "Filhos do Fluxo",
    },
  ]);

  // --- Round 1 (migration 0011) -----------------------------------------------
  await knex("rounds").insert({
    round_number: 1,
    started_at: knex.fn.now(),
    status: "active",
  });

  // --- 6 game_params (migration 0013) -----------------------------------------
  await knex("game_params").insert([
    { key: "ROUND_DURATION_DAYS", value: "14" },
    { key: "NIL_REGEN_MINUTES", value: "5" },
    { key: "GIG_COOLDOWN_MINUTES", value: "10" },
    { key: "PVP_NIL_COST", value: "10" },
    { key: "INITIAL_BALANCE", value: "500" },
    { key: "MAX_CREW_SIZE", value: "4" },
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// DOWN (rollback — reverse order)
// ═══════════════════════════════════════════════════════════════════════════

export async function down(knex: Knex): Promise<void> {
  // Triggers and functions first
  await knex.raw(`DROP TRIGGER IF EXISTS "trg_crew_member_limit" ON "crew_members"`);
  await knex.raw(`DROP FUNCTION IF EXISTS enforce_crew_member_limit()`);

  // Tables (reverse dependency order, with CASCADE to handle FKs)
  const tables = [
    "game_params",
    "audit_log",
    "round_stats",
    "rounds",
    "crew_invites",
    "crew_members",
    "crews",
    "legends",
    "pvp_combats",
    "heat",
    "gig_history",
    "active_gigs",
    "gigs",
    "installed_chrome",
    "chrome_definitions",
    "game_events",
    "loot_tables",
    "vendor_inventory",
    "vendors",
    "transaction_log",
    "character_wallets",
    "characters",
    "users",
    "health",
  ];

  for (const tableName of tables) {
    await knex.raw(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
  }

  // Enums (must drop after all tables that reference them)
  const enums = [
    "audit_result",
    "round_status",
    "chrome_slot",
    "history_outcome",
    "gig_outcome",
    "gig_phase",
    "gig_tier",
    "gig_type",
    "game_event_type",
    "vendor_type",
    "transaction_type",
    "user_role",
    "origin",
    "role",
  ];

  for (const enumName of enums) {
    await knex.raw(`DROP TYPE IF EXISTS "${enumName}" CASCADE`);
  }
}
