import bcrypt from "bcrypt";
import { env } from "../env";
import { userRepository as users } from "../repositories/user-repository";
import { characterRepository as characters } from "../repositories/character-repository";
import { walletRepository as wallets } from "../repositories/wallet-repository";

// Neon Dusk — Test user seeder
// ============================================================================
// Creates a persistent test user (player) with a character from env vars on
// startup. Idempotent: if the test user already exists, its stored hash is
// converged to the env password (re-hash only when the hash no longer
// matches). A non-player user squatting the test user email is left
// untouched. Called from the app's `onReady` hook so it runs once after
// migrations are applied.

const BCRYPT_ROUNDS = 12;

/**
 * Seed the test user account if TEST_USER_EMAIL and TEST_USER_PASSWORD are set.
 * Idempotent — converges an existing player's hash to the env password;
 * never touches the hash of a non-player user occupying the same email.
 */
export async function seedTestUser(): Promise<void> {
  if (!env.TEST_USER_EMAIL || !env.TEST_USER_PASSWORD) {
    console.log("[test-user-seed] TEST_USER_EMAIL or TEST_USER_PASSWORD not set — skipping");
    return;
  }

  const lowerEmail = env.TEST_USER_EMAIL.toLowerCase();

  // Emails are stored lowercase; the functional index enforces uniqueness.
  const existing = await users.findByEmail(lowerEmail);

  if (existing) {
    // Never overwrite the hash of a non-player account squatting the test
    // user email — that account belongs to them. Skip with a clear log.
    if (existing.role !== "player") {
      console.log(
        `[test-user-seed] User ${lowerEmail} exists with role "${existing.role}" (not player) — skipping hash convergence`,
      );
      return;
    }
    // Converge the stored hash to the env password so a changed
    // TEST_USER_PASSWORD takes effect without a manual DB reset. No-op when
    // the hash already matches.
    const matches = await bcrypt.compare(env.TEST_USER_PASSWORD, existing.password_hash);
    if (matches) {
      console.log("[test-user-seed] Test user already exists — skipping");
      return;
    }
    await users.updatePasswordHash(existing.id, await bcrypt.hash(env.TEST_USER_PASSWORD, BCRYPT_ROUNDS));
    console.log("[test-user-seed] Test user password updated from env:", lowerEmail);
    return;
  }

  const passwordHash = await bcrypt.hash(env.TEST_USER_PASSWORD, BCRYPT_ROUNDS);

  const newUser = await users.insert({
    email: lowerEmail,
    password_hash: passwordHash,
    role: "player",
  });

  // ponytail: roleEnum has no generalist archetype — using "bicho" (closest match).
  // ponytail: CHECK constraint requires attr sum == 22, so we distribute the 7 free
  // points across the 5 base stats (3 each = 15): body=5 reflex=5 int=5 technical=4
  // cool=3 = 22. Adjust if point-buy rules change.
  const newChar = await characters.insert({
    user_id: newUser.id,
    name: "Zanetti",
    origin: "a_quebrada",
    role: "bicho",
    body: 5,
    reflexes: 5,
    intelligence: 5,
    technical: 4,
    cool: 3,
    street_cred: 0,
    humanity: 100,
  });

  // ponytail: Grana lives on character_wallets, not characters. Seed a
  // zero-balance wallet so balance reads don't 404/undefined.
  await wallets.insert(newChar.id, {
    balance: 0,
    escrow: 0,
    lifetime_earned: 0,
    lifetime_spent: 0,
  });

  console.log("[test-user-seed] Test user created:", lowerEmail);
}
