import bcrypt from "bcrypt";
import { db } from "../db";
import { env } from "../env";

// Neon Dusk — Test user seeder
// ============================================================================
// Creates a persistent test user (player) with a character from env vars on
// startup. Fully idempotent: if the test user already exists, this is a no-op.
// Called from the app's `onReady` hook so it runs once after migrations are
// applied.

const BCRYPT_ROUNDS = 12;

/**
 * Seed the test user account if TEST_USER_EMAIL and TEST_USER_PASSWORD are set.
 * Idempotent — no-op when the user already exists.
 */
export async function seedTestUser(): Promise<void> {
  if (!env.TEST_USER_EMAIL || !env.TEST_USER_PASSWORD) {
    console.log("[test-user-seed] TEST_USER_EMAIL or TEST_USER_PASSWORD not set — skipping");
    return;
  }

  const lowerEmail = env.TEST_USER_EMAIL.toLowerCase();

  const existing = await db("users")
    .select("id")
    .whereRaw("lower(email) = ?", [lowerEmail])
    .limit(1);

  if (existing.length > 0) {
    console.log("[test-user-seed] Test user already exists — skipping");
    return;
  }

  const passwordHash = await bcrypt.hash(env.TEST_USER_PASSWORD, BCRYPT_ROUNDS);

  const [newUser] = await db("users")
    .insert({
      email: lowerEmail,
      password_hash: passwordHash,
      role: "player",
    })
    .returning("id");

  // ponytail: roleEnum has no "runner" — using "solo" (closest generalist archetype).
  // ponytail: CHECK constraint requires attr sum == 22, so we distribute the 7 free
  // points across the 5 base stats (3 each = 15): body=5 reflex=5 int=5 tech=4
  // cool=3 = 22. Adjust if point-buy rules change.
  const [newChar] = await db("characters")
    .insert({
      user_id: newUser.id,
      name: "Zanetti",
      origin: "a_quebrada",
      role: "solo",
      body: 5,
      reflexes: 5,
      intelligence: 5,
      technical: 4,
      cool: 3,
      street_cred: 0,
      humanity: 100,
    })
    .returning("id");

  // ponytail: eddies lives on character_wallets, not characters. Seed a
  // zero-balance wallet so balance reads don't 404/undefined.
  await db("character_wallets").insert({
    character_id: newChar.id,
    balance: 0,
    escrow: 0,
    lifetime_earned: 0,
    lifetime_spent: 0,
    version: 0,
  });

  console.log("[test-user-seed] Test user created:", lowerEmail);
}
