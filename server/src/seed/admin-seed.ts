import bcrypt from "bcrypt";
import { env } from "../env";
import { userRepository as users } from "../repositories/user-repository";

// Neon Dusk — Admin account seeder (ND-052)
// ============================================================================
// Creates the initial admin account from env vars on startup. Idempotent: if
// the admin user already exists, its stored hash is converged to the env
// password (re-hash only when the hash no longer matches). A non-admin user
// squatting the admin email is left untouched. Called from the app's `onReady`
// hook so it runs once after migrations are applied.

const BCRYPT_ROUNDS = 12;

/**
 * Seed the admin account if ADMIN_EMAIL and ADMIN_PASSWORD are set.
 * Idempotent — converges an existing admin's hash to the env password;
 * never touches the hash of a non-admin user occupying the same email.
 */
export async function seedAdminAccount(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.log("[admin-seed] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping");
    return;
  }

  const lowerEmail = env.ADMIN_EMAIL.toLowerCase();

  // Emails are stored lowercase; the functional index enforces uniqueness.
  const existing = await users.findByEmail(lowerEmail);

  if (existing) {
    // Never overwrite the hash of a player who registered with the admin
    // email — that account belongs to them. Skip with a clear log.
    if (existing.role !== "admin") {
      console.log(
        `[admin-seed] User ${lowerEmail} exists with role "${existing.role}" (not admin) — skipping hash convergence`,
      );
      return;
    }
    // Converge the stored hash to the env password so a changed ADMIN_PASSWORD
    // (e.g. a schema-compatible replacement for the old seed value) takes
    // effect without a manual DB reset. No-op when the hash already matches.
    const matches = await bcrypt.compare(env.ADMIN_PASSWORD, existing.password_hash);
    if (matches) {
      console.log("[admin-seed] Admin account already exists — skipping");
      return;
    }
    await users.updatePasswordHash(existing.id, await bcrypt.hash(env.ADMIN_PASSWORD, BCRYPT_ROUNDS));
    console.log("[admin-seed] Admin password updated from env:", lowerEmail);
    return;
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, BCRYPT_ROUNDS);

  await users.insert({
    email: lowerEmail,
    password_hash: passwordHash,
    role: "admin",
  });

  console.log("[admin-seed] Admin account created:", lowerEmail);
}
