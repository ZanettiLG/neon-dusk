import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0008: vendor_inventory
 * ============================================================================
 * Vendor stock rows. Split out of the consolidated 0001_initial_schema
 * migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
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

  await knex.raw(
    `ALTER TABLE "vendor_inventory" ADD CONSTRAINT "vendor_inventory_price_positive" CHECK ("price" > 0)`,
  );

  await knex.raw(
    `CREATE UNIQUE INDEX "vendor_inventory_unique_item" ON "vendor_inventory" ("vendor_id", "item_type", "item_id")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "vendor_inventory_unique_item"`);
  await knex.raw(`DROP TABLE IF EXISTS "vendor_inventory" CASCADE`);
}
