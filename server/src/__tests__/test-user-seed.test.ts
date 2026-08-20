import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcrypt";
import { db } from "../db";
import { resetDb } from "./helpers";
import { seedTestUser } from "../seed/test-user-seed";
import { env } from "../env";

// #39 — test user seeder. Real Postgres on the isolated test stack (same
// pattern as admin-seed.test.ts). Covers the #39 hash-convergence fix (same
// class as B1): when the test user already exists with a stale password hash,
// the seed re-hashes it to the env password instead of skipping silently.

const TEST_USER_EMAIL = "testuser@neondusk.test";
const TEST_USER_PASSWORD = "Test-Password-123";
const OLD_PASSWORD = "Old-Password-456";

async function findTestUser() {
  const rows = await db("users").select("*").where("email", TEST_USER_EMAIL).limit(1);
  return rows.length ? rows[0] : null;
}

describe("test user seed (#39)", () => {
  beforeEach(async () => {
    await resetDb();
    env.TEST_USER_EMAIL = TEST_USER_EMAIL;
    env.TEST_USER_PASSWORD = TEST_USER_PASSWORD;
  });

  afterEach(() => {
    // Restore the singleton so the .env-loaded values survive for other suites
    // (vitest runs all files in a single fork — module state is shared).
    env.TEST_USER_EMAIL = undefined;
    env.TEST_USER_PASSWORD = undefined;
  });

  it("should create the test user with a character when it does not exist", async () => {
    await seedTestUser();

    const row = await findTestUser();
    expect(row).not.toBeNull();
    expect(row!.role).toBe("player");
    expect(await bcrypt.compare(TEST_USER_PASSWORD, row!.password_hash)).toBe(true);

    const characters = await db("characters").select("*").where("user_id", row!.id);
    expect(characters).toHaveLength(1);
    expect(characters[0]!.name).toBe("Zanetti");
  });

  it("should be a no-op when the test user exists with the current env password hash", async () => {
    const hash = await bcrypt.hash(TEST_USER_PASSWORD, 12);
    await db("users").insert({ email: TEST_USER_EMAIL, password_hash: hash, role: "player" });

    await seedTestUser();

    // bcrypt salts are random — a re-hash would produce a different string.
    // Byte-identical hash proves updatePasswordHash was NOT called.
    const row = await findTestUser();
    expect(row!.password_hash).toBe(hash);
  });

  it("should re-hash to the env password when the test user exists with an old password hash", async () => {
    const oldHash = await bcrypt.hash(OLD_PASSWORD, 12);
    await db("users").insert({ email: TEST_USER_EMAIL, password_hash: oldHash, role: "player" });

    await seedTestUser();

    const row = await findTestUser();
    expect(row!.password_hash).not.toBe(oldHash);
    expect(await bcrypt.compare(TEST_USER_PASSWORD, row!.password_hash)).toBe(true);
    expect(await bcrypt.compare(OLD_PASSWORD, row!.password_hash)).toBe(false);
  });

  it("should skip when TEST_USER_EMAIL or TEST_USER_PASSWORD is not set", async () => {
    env.TEST_USER_EMAIL = undefined;
    env.TEST_USER_PASSWORD = undefined;

    await seedTestUser();

    expect(await findTestUser()).toBeNull();
  });

  it("should NOT overwrite the hash when a non-player user exists with the test user email", async () => {
    const adminHash = await bcrypt.hash(OLD_PASSWORD, 12);
    await db("users").insert({ email: TEST_USER_EMAIL, password_hash: adminHash, role: "admin" });

    await seedTestUser();

    // The admin's account is left untouched: same role, byte-identical hash,
    // and the old password still authenticates.
    const row = await findTestUser();
    expect(row!.role).toBe("admin");
    expect(row!.password_hash).toBe(adminHash);
    expect(await bcrypt.compare(OLD_PASSWORD, row!.password_hash)).toBe(true);
  });
});
