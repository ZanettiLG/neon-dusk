import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0027: rename role enum (ND-163)
 * ============================================================================
 * Renames the `role` enum from Cyberpunk RED class names (solo, netrunner,
 * tech, fixer, nomad) to Neon Dusk brand names (bicho, vulto, gambiarrista,
 * despachante, estradeiro) — 06-terminologia-e-ip.md.
 *
 * Strategy: rename the old type out of the way, create the new one, convert
 * `characters.role` with an explicit CASE (no ELSE — a value outside the
 * mapping fails loudly), then drop the old type without CASCADE (any missed
 * dependent object aborts the migration). A pre-flight DO block fails early
 * if the column holds values outside the known set, keeping the conversion
 * total and reversible.
 *
 * Knex runs each migration inside a transaction by default, so the whole
 * up/down is atomic.
 */

const OLD_ROLE_VALUES = ["solo", "netrunner", "tech", "fixer", "nomad"] as const;
const NEW_ROLE_VALUES = ["bicho", "vulto", "gambiarrista", "despachante", "estradeiro"] as const;

/** Old → new role mapping (up). */
const UP_MAPPING: Record<string, string> = {
  solo: "bicho",
  netrunner: "vulto",
  tech: "gambiarrista",
  fixer: "despachante",
  nomad: "estradeiro",
};

/** Pre-flight guard: RAISE EXCEPTION when characters.role holds values outside `allowed`. */
function preflightSql(allowed: readonly string[]): string {
  const quoted = allowed.map((v) => `'${v}'`).join(", ");
  // Single quotes inside the RAISE message must be doubled for SQL string literal.
  const messageList = quoted.replaceAll("'", "''");
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM "characters" WHERE "role"::text NOT IN (${quoted})
      ) THEN
        RAISE EXCEPTION 'migration 0027: characters.role contém valores fora do enum esperado (${messageList})';
      END IF;
    END $$;
  `;
}

/** CASE expression converting the column between the old and new enum. */
function caseSql(mapping: Record<string, string>): string {
  const whens = Object.entries(mapping)
    .map(([from, to]) => `WHEN '${from}' THEN '${to}'::"role"`)
    .join(" ");
  return `CASE "role"::text ${whens} END`;
}

export async function up(knex: Knex): Promise<void> {
  await knex.raw(preflightSql(OLD_ROLE_VALUES));
  await knex.raw(`ALTER TYPE "role" RENAME TO "role_old"`);
  await knex.raw(
    `CREATE TYPE "role" AS ENUM(${NEW_ROLE_VALUES.map((v) => `'${v}'`).join(", ")})`,
  );
  await knex.raw(
    `ALTER TABLE "characters" ALTER COLUMN "role" TYPE "role" USING (${caseSql(UP_MAPPING)})`,
  );
  await knex.raw(`DROP TYPE "role_old"`);
}

export async function down(knex: Knex): Promise<void> {
  const inverse = Object.fromEntries(
    Object.entries(UP_MAPPING).map(([from, to]) => [to, from]),
  );

  await knex.raw(preflightSql(NEW_ROLE_VALUES));
  await knex.raw(`ALTER TYPE "role" RENAME TO "role_old"`);
  await knex.raw(
    `CREATE TYPE "role" AS ENUM(${OLD_ROLE_VALUES.map((v) => `'${v}'`).join(", ")})`,
  );
  await knex.raw(
    `ALTER TABLE "characters" ALTER COLUMN "role" TYPE "role" USING (${caseSql(inverse)})`,
  );
  await knex.raw(`DROP TYPE "role_old"`);
}
