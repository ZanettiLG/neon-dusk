import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcrypt";
import { db } from "../db";
import { resetDb } from "./helpers";
import { seedAdminAccount } from "../seed/admin-seed";
import { env } from "../env";

// ND-052 — admin account seeder. Real Postgres on the isolated test stack
// (same pattern as seed-integration.test.ts). Covers the #191 hash-convergence
// fix: when the admin already exists with a stale password hash, the seed
// re-hashes it to the env password instead of skipping silently.

const ADMIN_EMAIL = "admin@neondusk.test";
const ADMIN_PASSWORD = "Admin-Password-123";
const OLD_PASSWORD = "Old-Password-456";

async function findAdmin() {
  const rows = await db("users").select("*").where("email", ADMIN_EMAIL).limit(1);
  return rows.length ? rows[0] : null;
}

describe("admin seed (ND-052)", () => {
  beforeEach(async () => {
    await resetDb();
    env.ADMIN_EMAIL = ADMIN_EMAIL;
    env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  });

  afterEach(() => {
    // Restore the singleton so the .env-loaded values survive for other suites
    // (vitest runs all files in a single fork — module state is shared).
    env.ADMIN_EMAIL = undefined;
    env.ADMIN_PASSWORD = undefined;
  });

  it("should create the admin account with the env password hash when it does not exist", async () => {
    await seedAdminAccount();

    const row = await findAdmin();
    expect(row).not.toBeNull();
    expect(row!.role).toBe("admin");
    expect(await bcrypt.compare(ADMIN_PASSWORD, row!.password_hash)).toBe(true);
  });

  it("should be a no-op when the admin exists with the current env password hash", async () => {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await db("users").insert({ email: ADMIN_EMAIL, password_hash: hash, role: "admin" });

    await seedAdminAccount();

    // bcrypt salts are random — a re-hash would produce a different string.
    // Byte-identical hash proves updatePasswordHash was NOT called.
    const row = await findAdmin();
    expect(row!.password_hash).toBe(hash);
  });

  it("should re-hash to the env password when the admin exists with an old password hash", async () => {
    const oldHash = await bcrypt.hash(OLD_PASSWORD, 12);
    await db("users").insert({ email: ADMIN_EMAIL, password_hash: oldHash, role: "admin" });

    await seedAdminAccount();

    const row = await findAdmin();
    expect(row!.password_hash).not.toBe(oldHash);
    expect(await bcrypt.compare(ADMIN_PASSWORD, row!.password_hash)).toBe(true);
    expect(await bcrypt.compare(OLD_PASSWORD, row!.password_hash)).toBe(false);
  });

  it("should skip when ADMIN_EMAIL or ADMIN_PASSWORD is not set", async () => {
    env.ADMIN_EMAIL = undefined;
    env.ADMIN_PASSWORD = undefined;

    await seedAdminAccount();

    expect(await findAdmin()).toBeNull();
  });

  it("should NOT overwrite the hash when a non-admin user exists with the admin email", async () => {
    const playerHash = await bcrypt.hash(OLD_PASSWORD, 12);
    await db("users").insert({ email: ADMIN_EMAIL, password_hash: playerHash, role: "player" });

    await seedAdminAccount();

    // The player's account is left untouched: same role, byte-identical hash,
    // and the old password still authenticates.
    const row = await findAdmin();
    expect(row!.role).toBe("player");
    expect(row!.password_hash).toBe(playerHash);
    expect(await bcrypt.compare(OLD_PASSWORD, row!.password_hash)).toBe(true);
  });
});
