import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { buildKnexConfig } from "../db/config";

// #158 DB repository layer — the shared Knex config builder.
// Pure unit tests (no DB): the builder must resolve migration/seed
// directories to ABSOLUTE paths that exist, use the canonical migrations
// table, and stay free of env.ts so the Knex CLI can load it in CI.

describe("buildKnexConfig", () => {
  it("should resolve migrations and seeds directories to absolute paths that exist", () => {
    const cfg = buildKnexConfig("postgres://x");
    const migrationsDir = cfg.migrations!.directory as string;
    const seedsDir = cfg.seeds!.directory as string;

    expect(migrationsDir).toBeTruthy();
    expect(seedsDir).toBeTruthy();
    // Absolute paths, independent of the process working directory.
    expect(migrationsDir.startsWith("/")).toBe(true);
    expect(seedsDir.startsWith("/")).toBe(true);
    expect(existsSync(migrationsDir)).toBe(true);
    expect(existsSync(seedsDir)).toBe(true);
  });

  it("should use the canonical knex_migrations table name", () => {
    const cfg = buildKnexConfig("postgres://x");
    expect(cfg.migrations!.tableName).toBe("knex_migrations");
  });

  it("should use the pg client and ts extension for migrations and seeds", () => {
    const cfg = buildKnexConfig("postgres://x");
    expect(cfg.client).toBe("pg");
    expect(cfg.migrations!.extension).toBe("ts");
    expect(cfg.seeds!.extension).toBe("ts");
  });

  it("should pass through the connection string unchanged", () => {
    const url = "postgres://user:pass@host:5432/db";
    const cfg = buildKnexConfig(url);
    expect(cfg.connection).toBe(url);
  });
});
