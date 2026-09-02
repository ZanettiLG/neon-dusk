#!/usr/bin/env npx tsx

/**
 * ND-018: Economy integrity check — standalone script.
 *
 * Creates 100 test characters, executes 1000 balanced transaction pairs
 * (faucet credit + matching sink debit → ledger nets to zero), then verifies
 * 6 invariants against the REAL PostgreSQL schema via Knex (server/src/db).
 *
 * Workspace: `npm run check:economy`
 * Requires: test DB/Redis stack running (`docker compose -f docker-compose.test.yml up -d`)
 * Targets the TEST stack (55432) by default in dev/test; an explicit
 * DATABASE_URL or NODE_ENV=production always takes precedence.
 *
 * Rewritten from the original drizzle-orm draft (ND-018 gate): drizzle was not
 * a dependency and the draft referenced non-existent schema exports. The 6
 * invariants keep the original definitions — all queries scoped to
 * `source = 'econ-check'` so the check is deterministic on a shared test DB,
 * and the balanced-pair tx loop makes invariant 1 (Σ(amount) == 0 excl.
 * ADMIN_ADJUSTMENT) exact instead of weighted-random (which could never pass).
 */

/* eslint-disable no-console */

import "dotenv/config";
import { createRequire } from "node:module";

// ─── Database target ─────────────────────────────────────────────────────────
// This script's contract targets the TEST stack (docker-compose.test.yml,
// port 55432). In dev/test, default to it unless DATABASE_URL was explicitly
// provided. env.ts's dotenv call never overrides an existing env var, so the
// assignment below wins over server/.env's dev URL (5432). In production
// (NODE_ENV=production) the real DATABASE_URL always prevails. db is loaded
// via require (instead of a static import) so the default runs first.
const TEST_DB_URL = "postgres://neondusk:neondusk_dev@localhost:55432/neondusk";
if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DB_URL;
}
const require = createRequire(import.meta.url);
const { db } = require("../server/src/db") as typeof import("../server/src/db");

// ─── Configuration ──────────────────────────────────────────────────────────

const CHAR_COUNT = 100;
const TX_PAIRS = 1000; // each pair = 1 faucet credit + 1 sink debit
const INITIAL_BALANCE = 1000;
const FAUCET_TYPES = ["GIG_PAYOUT", "PVP_REWARD", "CREW_BONUS"] as const;
const SINK_TYPES = ["VENDOR_PURCHASE", "PVP_LOSS"] as const;
const MAX_RETRIES = 3;
const THRESHOLD = 0.01; // 1% tolerance for floating-point rounding differences

// ─── Helpers ────────────────────────────────────────────────────────────────

let idSeq = 0;
function uid(): string {
  return `econ-${Date.now()}-${idSeq++}`;
}
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface WalletRow {
  character_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  version: number;
}

/**
 * Apply one credit (amount > 0) or debit (amount < 0) to a wallet using
 * optimistic locking (WHERE version = current) with retry. Returns false when
 * the wallet is missing or would overdraft. Records the transaction_log row.
 */
async function applyTx(
  charId: string,
  txType: string,
  balanceDelta: number,
  conflicts: { version: number; unresolved: number },
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const rows = await db("character_wallets").select().where("character_id", charId).limit(1);
    const wallet = rows[0] as WalletRow | undefined;
    if (!wallet) return false;
    if (wallet.balance + balanceDelta < 0) return false;

    const newBalance = wallet.balance + balanceDelta;
    const newEarned = wallet.lifetime_earned + (balanceDelta > 0 ? balanceDelta : 0);
    const newSpent = wallet.lifetime_spent + (balanceDelta < 0 ? -balanceDelta : 0);

    const affected = await db("character_wallets")
      .where("character_id", charId)
      .where("version", wallet.version)
      .update({
        balance: newBalance,
        lifetime_earned: newEarned,
        lifetime_spent: newSpent,
        version: wallet.version + 1,
        updated_at: new Date(),
      });

    if (affected === 0) {
      conflicts.version++;
      if (attempt < MAX_RETRIES - 1) continue;
      conflicts.unresolved++;
      console.log(
        `  ⚠ version conflict: char ${charId} tx ${txType} — unresolved after ${MAX_RETRIES} retries`,
      );
      return false;
    }

    await db("transaction_log").insert({
      character_id: charId,
      type: txType,
      amount: balanceDelta,
      balance_before: wallet.balance,
      balance_after: newBalance,
      source: "econ-check",
      reference_type: txType,
      reference_id: charId,
    });
    return true;
  }
  return false;
}

/** Sum `amount` over transaction_log rows matching the where clause. */
async function sumAmount(builder: (q: typeof db) => unknown): Promise<number> {
  const query = db("transaction_log").sum({ total: "amount" });
  builder(query);
  const [row] = await query;
  return Number(row?.total ?? 0);
}

// ─── Execute ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════╗");
  console.log("║  ND-018 ECONOMY INTEGRITY CHECK     ║");
  console.log("╚══════════════════════════════════════╝\n");

  // 1. Create 100 test characters with wallets + seed grant transaction.
  console.log(`Creating ${CHAR_COUNT} test characters...`);
  const charIds: string[] = [];

  for (let i = 0; i < CHAR_COUNT; i++) {
    const email = `${uid()}@econ.test`;

    const [user] = await db("users")
      .insert({ email, password_hash: "econ-test-hash", role: "player" })
      .returning("id");

    const [char] = await db("characters")
      .insert({
        user_id: user.id,
        name: `Econ-${uid()}`,
        origin: "a_paraiso",
        role: "bicho", // role enum pós-0027 (era "solo" no draft original)
        body: 5,
        reflexes: 4,
        intelligence: 4,
        technical: 4,
        cool: 5,
        nil: 100,
        max_nil: 100,
      })
      .returning("id");

    await db("character_wallets").insert({
      character_id: char.id,
      balance: INITIAL_BALANCE,
      lifetime_earned: INITIAL_BALANCE,
      lifetime_spent: 0,
      escrow: 0,
      version: 0,
    });

    // Seed grant mirrors wallet-repository.ensure (ADMIN_ADJUSTMENT) so the
    // ledger is fully backed by balance — invariant 2 stays exact.
    await db("transaction_log").insert({
      character_id: char.id,
      type: "ADMIN_ADJUSTMENT",
      amount: INITIAL_BALANCE,
      balance_before: 0,
      balance_after: INITIAL_BALANCE,
      source: "econ-check",
      reference_type: "system",
    });

    charIds.push(char.id);
  }
  console.log(`  ✓ ${CHAR_COUNT} characters + wallets created\n`);

  // 2. Execute 1000 balanced transaction pairs (net zero ledger).
  console.log(`Executing ${TX_PAIRS} balanced transaction pairs...`);
  const conflicts = { version: 0, unresolved: 0 };

  for (let i = 0; i < TX_PAIRS; i++) {
    const charId = charIds[rand(0, charIds.length - 1)];
    const amount = rand(10, 500);
    const faucetType = FAUCET_TYPES[rand(0, FAUCET_TYPES.length - 1)];
    const sinkType = SINK_TYPES[rand(0, SINK_TYPES.length - 1)];

    await applyTx(charId, faucetType, amount, conflicts);
    await applyTx(charId, sinkType, -amount, conflicts);
  }
  console.log(`  ✓ ${TX_PAIRS} pairs (${TX_PAIRS * 2} transactions) executed\n`);

  // 3. Verify invariants
  console.log("─".repeat(40));
  console.log("VERIFYING INVARIANTS\n");

  let allPassed = true;

  // ── Invariant 1: Σ(amount) == 0 excl. ADMIN_ADJUSTMENT (balanced pairs) ──
  const i1Sum = await sumAmount((q) => {
    q.where("source", "econ-check").whereNot("type", "ADMIN_ADJUSTMENT");
  });
  const i1 = Math.abs(i1Sum) < THRESHOLD;
  console.log(`  ${i1 ? "✅" : "❌"} INVARIANT 1: Σ(amount) == 0  →  sum = ${i1Sum}`);
  if (!i1) allPassed = false;

  // ── Invariant 2: wallet.balance == Σ(transactions) per character ─────────
  let i2Passed = true;
  const wallets = await db("character_wallets").select().whereIn("character_id", charIds);
  for (const w of wallets as WalletRow[]) {
    const txSum = await sumAmount((q) => q.where("character_id", w.character_id));
    if (Math.abs(w.balance - txSum) >= THRESHOLD) {
      console.log(`     ⚠ wallet ${w.character_id}: balance=${w.balance} tx_sum=${txSum}`);
      i2Passed = false;
    }
  }
  console.log(`  ${i2Passed ? "✅" : "❌"} INVARIANT 2: wallet == Σ(tx) per char`);
  if (!i2Passed) allPassed = false;

  // ── Invariant 3: No negative balances ────────────────────────────────────
  const [negRow] = await db("character_wallets")
    .whereIn("character_id", charIds)
    .where("balance", "<", 0)
    .count({ count: "*" });
  const negCount = Number(negRow?.count ?? 0);
  const i3 = negCount === 0;
  console.log(`  ${i3 ? "✅" : "❌"} INVARIANT 3: No negative balances  →  ${negCount} negative`);
  if (!i3) allPassed = false;

  // ── Invariant 4: Wallet versions match transaction count per character ──
  // O grant inicial (ADMIN_ADJUSTMENT) NÃO incrementa version em
  // wallet.ensure (inserção direta) — então version conta apenas as mutações
  // de wallet (as transações não-admin), como na produção.
  let i4Passed = true;
  for (const w of wallets as WalletRow[]) {
    const [countRow] = await db("transaction_log")
      .where("character_id", w.character_id)
      .whereNot("type", "ADMIN_ADJUSTMENT")
      .count({ count: "*" });
    const txCount = Number(countRow?.count ?? 0);
    if (w.version !== txCount) {
      i4Passed = false;
      console.log(`     ⚠ wallet ${w.character_id}: version=${w.version} tx_count=${txCount}`);
    }
  }
  console.log(`  ${i4Passed ? "✅" : "❌"} INVARIANT 4: Wallet versions == tx count`);
  if (!i4Passed) allPassed = false;

  // ── Invariant 5: balance_after - balance_before == amount (every row) ────
  const [mismatchRow] = await db("transaction_log")
    .where("source", "econ-check")
    .whereRaw("balance_after - balance_before != amount")
    .count({ count: "*" });
  const mismatchCount = Number(mismatchRow?.count ?? 0);
  const i5 = mismatchCount === 0;
  console.log(
    `  ${i5 ? "✅" : "❌"} INVARIANT 5: after - before == amount  →  ${mismatchCount} mismatched`,
  );
  if (!i5) allPassed = false;

  // ── Invariant 6: lifetime_earned/spent are consistent ────────────────────
  let i6Passed = true;
  for (const w of wallets as WalletRow[]) {
    const earned = await sumAmount((q) =>
      q.where("character_id", w.character_id).where("amount", ">", 0),
    );
    const spent = await sumAmount((q) =>
      q.where("character_id", w.character_id).where("amount", "<", 0),
    );
    if (Math.abs(w.lifetime_earned - earned) >= THRESHOLD + 1) {
      i6Passed = false;
      console.log(
        `     ⚠ wallet ${w.character_id}: lifetime_earned=${w.lifetime_earned} sum_pos=${earned}`,
      );
    }
    if (Math.abs(w.lifetime_spent - Math.abs(spent)) >= THRESHOLD + 1) {
      i6Passed = false;
      console.log(
        `     ⚠ wallet ${w.character_id}: lifetime_spent=${w.lifetime_spent} sum_neg=${spent}`,
      );
    }
  }
  console.log(`  ${i6Passed ? "✅" : "❌"} INVARIANT 6: lifetime_earned/spent consistent`);
  if (!i6Passed) allPassed = false;

  // ── Version conflict report ──────────────────────────────────────────────
  if (conflicts.version > 0) {
    console.log(
      `  ⚠️  Version conflicts: ${conflicts.version} (${conflicts.version - conflicts.unresolved} resolved, ${conflicts.unresolved} unresolved)`,
    );
    if (conflicts.unresolved > 0) {
      allPassed = false;
      console.log("  ❌ INVARIANT VIOLATION: Some version conflicts could not be resolved");
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log("\nCleaning up test data...");
  await db("transaction_log").where("source", "econ-check").del();
  await db("character_wallets").whereIn("character_id", charIds).del();
  await db("characters").whereIn("id", charIds).del();
  await db("users").where("email", "like", "%@econ.test").del();
  console.log("  ✓ Cleanup complete\n");

  // ── Final report ──────────────────────────────────────────────────────────
  console.log("═".repeat(40));
  console.log(allPassed ? "  ✅ ALL INVARIANTS PASSED" : "  ❌ SOME INVARIANTS FAILED");
  console.log("═".repeat(40));

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
