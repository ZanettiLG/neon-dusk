import { config } from "dotenv";
// NOTE: explicit .ts extension — the knex CLI loads this file through Node's
// ESM loader (package.json type: module), which requires extensions for
// relative imports (tsx resolves them at runtime).
import { buildKnexConfig } from "./src/db/config.ts";

// Neon Dusk — Knex CLI configuration
// ============================================================================
// Loads .env (cwd-relative — the CLI is always invoked from server/) and
// delegates to the shared config builder in src/db/config.ts.
//
// CRITICAL: do NOT import env.ts here — it validates the full env schema
// (JWT secrets, ADMIN_API_KEY) which the CI test job does not provide.

config();

export default buildKnexConfig(
  process.env.DATABASE_URL ?? "postgres://neondusk:neondusk_dev@localhost:5432/neondusk",
);
