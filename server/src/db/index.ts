import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";

// BUGFIX BF-1: `client` MUST be exported so `migrate.ts` can call `client.end()`.
// The Drizzle `db` instance has no `.end()` — only the underlying postgres client does.
export const client = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  prepare: false,
});

export const db = drizzle({ client });

export * as schema from "./schema";
