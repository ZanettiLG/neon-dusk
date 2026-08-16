import pg from "pg";

// Neon Dusk — pg type parser overrides
// ============================================================================
// Imported once from db/index.ts BEFORE the Knex client is created, so every
// connection built by the pool shares these parsers.
//
// Postgres BIGINT (OID 20) arrives as a string by default in node-postgres.
// The economy tables (character_wallets.balance/escrow/lifetime_*,
// transaction_log.amount/balance_*) are BIGINT, and the codebase treats them
// as JS numbers everywhere.
//
// Precision trade-off: integers beyond Number.MAX_SAFE_INTEGER (2^53 − 1)
// lose exactness when parsed to `number`. Neon Dusk economy values are
// bounded far below that by game caps and CHECK constraints, so this is
// safe here — do not reuse this override for truly unbounded integer
// domains (e.g. external ids, crypto amounts).
pg.types.setTypeParser(20, (value) => parseInt(value, 10));
