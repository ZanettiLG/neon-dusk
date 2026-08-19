import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0020: crew_members
 * ============================================================================
 * Crew roster + the 4-member limit trigger. Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
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

  await knex.raw(
    `CREATE INDEX "idx_crew_members_crew_id" ON "crew_members" ("crew_id")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TRIGGER IF EXISTS "trg_crew_member_limit" ON "crew_members"`);
  await knex.raw(`DROP FUNCTION IF EXISTS enforce_crew_member_limit()`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_crew_members_crew_id"`);
  await knex.raw(`DROP TABLE IF EXISTS "crew_members" CASCADE`);
}
