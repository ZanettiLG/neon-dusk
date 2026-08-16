import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Deterministic .env path: always <repo>/server/.env, regardless of the
// process working directory (dotenv's default cwd-relative resolution breaks
// when the server is launched from the repo root, e.g. `tsx server/src/server.ts`).
export const ENV_FILE_PATH = fileURLToPath(new URL("../.env", import.meta.url));

/**
 * Loads the .env file from the deterministic path. Seam exported for tests
 * so they can point dotenv at a fixture file.
 */
export function loadDotenv(path = ENV_FILE_PATH) {
  return config({ path });
}

// Load .env before schema parsing
loadDotenv();

export const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Database
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://neondusk:neondusk_dev@localhost:5432/neondusk"),

  // Redis
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),

  // Auth
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

  // Admin (ND-007): API key guarding the /api/admin/* endpoints.
  ADMIN_API_KEY: z.string().min(32, "ADMIN_API_KEY must be at least 32 characters"),

  // Admin Panel (ND-052): auto-seed admin account on startup.
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),

  // Test User: auto-seed persistent test user on startup (idempotent).
  TEST_USER_EMAIL: z.string().email().optional(),
  TEST_USER_PASSWORD: z.string().min(8).optional(),

  // Telemetry (ND-007): opt-in Node.js runtime metrics on the Prometheus registry.
  PROMETHEUS_COLLECT_DEFAULTS: z.enum(["true", "false"]).default("false"),

  // CORS
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Round System (ND-017): 14-day rounds with a 60-minute intermission.
  ROUND_DURATION_DAYS: z.coerce.number().int().positive().default(14),
  ROUND_INTERMISSION_MINUTES: z.coerce.number().int().positive().default(60),

  // Anti-Cheat (ND-053): when "false", circuit-break enforcement is skipped
  // (useful for test environments).
  ANTI_CHEAT_STRICT_MODE: z.enum(["true", "false"]).default("true"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.format());
    console.error(`Checked env file: ${ENV_FILE_PATH}`);
    console.error("Tip: copy server/.env.example to server/.env and fill the required values.");
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
