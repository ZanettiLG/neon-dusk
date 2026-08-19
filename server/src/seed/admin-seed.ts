import bcrypt from "bcrypt";
import { env } from "../env";
import { userRepository as users } from "../repositories/user-repository";

// Neon Dusk — Admin account seeder (ND-052)
// ============================================================================
// Creates the initial admin account from env vars on startup. Fully idempotent:
// if the admin user already exists, this is a no-op. Called from the app's
// `onReady` hook so it runs once after migrations are applied.

const BCRYPT_ROUNDS = 12;

/**
 * Seed the admin account if ADMIN_EMAIL and ADMIN_PASSWORD are set.
 * Idempotent — no-op when the user already exists.
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
    console.log("[admin-seed] Admin account already exists — skipping");
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
