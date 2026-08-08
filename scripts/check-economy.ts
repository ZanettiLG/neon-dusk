#!/usr/bin/env npx tsx

/**
 * ND-018: Economy integrity check — standalone script.
 *
 * Creates 100 test characters, executes 1000 random transactions, then
 * verifies 6 invariants. Uses the real DB (DATABASE_URL from env).
 *
 * Workspace: `npx tsx scripts/check-economy.ts`
 * Requires: test DB/Redis stack running (`docker compose -f docker-compose.test.yml up -d`)
 */

/* eslint-disable no-console */

import "dotenv/config";
import { eq, sql, ne, and } from "drizzle-orm";
import { db } from "../server/src/db";
import {
  characters,
  characterWallets,
  transactionLog,
  users,
} from "../server/src/db/schema";

// ─── Configuration ──────────────────────────────────────────────────────────

const CHAR_COUNT = 100;
const TX_COUNT = 1000;
const TX_TYPES = [
  { type: "GIG_PAYOUT" as const, weight: 40 },
  { type: "VENDOR_PURCHASE" as const, weight: 30 },
  { type: "PVP_REWARD" as const, weight: 15 },
  { type: "PVP_LOSS" as const, weight: 10 },
  { type: "CREW_BONUS" as const, weight: 5 },
];

const THRESHOLD = 0.01; // 1% tolerance for floating-point rounding differences

// ─── Helpers ────────────────────────────────────────────────────────────────

let idSeq = 0;
function uid(): string {
  return `econ-${Date.now()}-${idSeq++}`;
}
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(): (typeof TX_TYPES)[number]["type"] {
  const total = TX_TYPES.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const entry of TX_TYPES) {
    r -= entry.weight;
    if (r <= 0) return entry.type;
  }
  return TX_TYPES[0].type;
}

// ─── Execute ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════╗");
  console.log("║  ND-018 ECONOMY INTEGRITY CHECK     ║");
  console.log("╚══════════════════════════════════════╝\n");

  // 1. Create 100 test characters with wallets
  console.log(`Creating ${CHAR_COUNT} test characters...`);
  const created: { charId: string; b4Name: string }[] = [];

  for (let i = 0; i < CHAR_COUNT; i++) {
    const email = `${uid()}@econ.test`;
    const charName = `Econ-${uid()}`;

    const [user] = await db
      .insert(users)
      .values({ email, passwordHash: "econ-test-hash", role: "player" })
      .returning({ id: users.id });

    const [char] = await db
      .insert(characters)
      .values({
        userId: user.id,
        name: charName,
        origin: "a_paraiso",
        role: "solo",
        body: 5,
        reflexes: 4,
        intelligence: 4,
        technical: 4,
        cool: 5,
        nil: 100,
        maxNil: 100,
      })
      .returning({ id: characters.id });

    await db.insert(characterWallets).values({
      characterId: char.id,
      balance: 1000,
      lifetimeEarned: 1000,
      lifetimeSpent: 0,
      version: 0,
    });

    created.push({ charId: char.id, b4Name: charName });
  }
  console.log(`  ✓ ${CHAR_COUNT} characters + wallets created\n`);

  // 2. Execute 1000 random transactions
  console.log(`Executing ${TX_COUNT} random transactions...`);
  let versionConflicts = 0;
  let unresolvedConflicts = 0;
  const MAX_RETRIES = 3;

  for (let i = 0; i < TX_COUNT; i++) {
    const { charId } = created[rand(0, created.length - 1)];
    const txType = pickWeighted();
    const amount = rand(10, 500);

    let committed = false;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Read current wallet with version
      const [wallet] = await db
        .select()
        .from(characterWallets)
        .where(eq(characterWallets.characterId, charId));

      if (!wallet) break;

      const isDebit =
        txType === "VENDOR_PURCHASE" || txType === "PVP_LOSS";
      const balanceDelta = isDebit ? -amount : amount;

      // Skip if debit would make balance negative
      if (balanceDelta < 0 && wallet.balance + balanceDelta < 0) break;

      const newBalance = wallet.balance + balanceDelta;
      const newEarned = wallet.lifetimeEarned + (balanceDelta > 0 ? Math.abs(balanceDelta) : 0);
      const newSpent = wallet.lifetimeSpent + (balanceDelta < 0 ? Math.abs(balanceDelta) : 0);

      const result = await db
        .update(characterWallets)
        .set({
          balance: newBalance,
          lifetimeEarned: newEarned,
          lifetimeSpent: newSpent,
          version: wallet.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(characterWallets.characterId, charId),
            eq(characterWallets.version, wallet.version),
          ),
        );

      // Detect version conflict (optimistic lock failure)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((result as any).rowCount === 0) {
        versionConflicts++;
        if (attempt < MAX_RETRIES - 1) continue; // retry
        unresolvedConflicts++;
        console.log(
          `  ⚠ version conflict: char ${charId} tx ${txType} — unresolved after ${MAX_RETRIES} retries`,
        );
        break;
      }

      await db.insert(transactionLog).values({
        characterId: charId,
        type: txType,
        amount: balanceDelta,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        source: "econ-check",
        referenceType: txType,
        referenceId: charId,
      });

      committed = true;
      break;
    }
    // If wallet doesn't exist or all attempts exhausted, skip this tx
    if (!committed) continue;
  }
  console.log(`  ✓ ${TX_COUNT} transactions executed\n`);

  // 3. Verify invariants
  console.log("─".repeat(40));
  console.log("VERIFYING INVARIANTS\n");

  let allPassed = true;

  // ── Invariant 1: Σ(amount) == 0 (excl. ADMIN_ADJUSTMENT) ─────────────────
  const ledgerSum = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactionLog.amount}), 0)` })
    .from(transactionLog)
    .where(ne(transactionLog.type, "ADMIN_ADJUSTMENT"));

  const sum = Number(ledgerSum[0]?.total ?? 0);
  const i1 = Math.abs(sum) < THRESHOLD;
  console.log(`  ${i1 ? "✅" : "❌"} INVARIANT 1: Σ(amount) == 0  →  sum = ${sum}`);
  if (!i1) allPassed = false;

  // ── Invariant 2: wallet.balance == Σ(transactions) per character ─────────
  let i2Passed = true;
  const wallets = await db.select().from(characterWallets).where(
    sql`${characterWallets.characterId} IN (${created.map((c) => c.charId).map((id) => `'${id}'`).join(",")})`,
  );
  for (const w of wallets) {
    const txSum = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionLog.amount}), 0)` })
      .from(transactionLog)
      .where(eq(transactionLog.characterId, w.characterId));

    const charBalance = Number(txSum[0]?.total ?? 0);
    if (Math.abs(w.balance - charBalance) >= THRESHOLD) {
      console.log(
        `     ⚠ wallet ${w.characterId}: balance=${w.balance} tx_sum=${charBalance}`,
      );
      i2Passed = false;
    }
  }
  console.log(`  ${i2Passed ? "✅" : "❌"} INVARIANT 2: wallet == Σ(tx) per char`);
  if (!i2Passed) allPassed = false;

  // ── Invariant 3: No negative balances ────────────────────────────────────
  const negWallets = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(characterWallets)
    .where(sql`${characterWallets.balance} < 0`);

  const i3 = Number(negWallets[0]?.count ?? 0) === 0;
  console.log(`  ${i3 ? "✅" : "❌"} INVARIANT 3: No negative balances  →  ${negWallets[0]?.count ?? "?"} negative`);
  if (!i3) allPassed = false;

  // ── Invariant 4: Wallet versions match transaction count per character ──
  let i4Passed = true;
  for (const w of wallets) {
    const txCountResult = await db
      .select({ count: sql<string>`COUNT(*)::int` })
      .from(transactionLog)
      .where(eq(transactionLog.characterId, w.characterId));

    const txCount = Number(txCountResult[0]?.count ?? 0);
    if (w.version !== txCount) {
      i4Passed = false;
      console.log(
        `     ⚠ wallet ${w.characterId}: version=${w.version} tx_count=${txCount}`,
      );
    }
  }
  console.log(`  ${i4Passed ? "✅" : "❌"} INVARIANT 4: Wallet versions == tx count`);
  if (!i4Passed) allPassed = false;

  // ── Invariant 5: balance_after - balance_before == amount (every row) ────
  const mismatchedRows = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(transactionLog)
    .where(
      sql`${transactionLog.balanceAfter} - ${transactionLog.balanceBefore} != ${transactionLog.amount}`,
    );

  const i5 = Number(mismatchedRows[0]?.count ?? 0) === 0;
  console.log(
    `  ${i5 ? "✅" : "❌"} INVARIANT 5: after - before == amount  →  ${mismatchedRows[0]?.count ?? "?"} mismatched`,
  );
  if (!i5) allPassed = false;

  // ── Invariant 6: lifetime_earned/spent are consistent ────────────────────
  let i6Passed = true;
  for (const w of wallets) {
    // lifetime_earned should be the sum of all positive amounts
    const earnedSum = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionLog.amount}), 0)` })
      .from(transactionLog)
      .where(
        and(
          eq(transactionLog.characterId, w.characterId),
          sql`${transactionLog.amount} > 0`,
        ),
      );
    const spentSum = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionLog.amount}), 0)` })
      .from(transactionLog)
      .where(
        and(
          eq(transactionLog.characterId, w.characterId),
          sql`${transactionLog.amount} < 0`,
        ),
      );

    const earned = Number(earnedSum[0]?.total ?? 0);
    const spent = Math.abs(Number(spentSum[0]?.total ?? 0));
    if (
      Math.abs(w.lifetimeEarned - earned) >= THRESHOLD + 1 ||
      Math.abs(w.lifetimeSpent - spent) >= THRESHOLD + 1
    ) {
      i6Passed = false;
    }
  }
  console.log(`  ${i6Passed ? "✅" : "❌"} INVARIANT 6: lifetime_earned/spent consistent`);
  if (!i6Passed) allPassed = false;

  // ── Version conflict report ──────────────────────────────────────────────
  if (versionConflicts > 0) {
    console.log(
      `  ⚠️  Version conflicts: ${versionConflicts} (${versionConflicts - unresolvedConflicts} resolved, ${unresolvedConflicts} unresolved)`,
    );
    if (unresolvedConflicts > 0) {
      allPassed = false;
      console.log(
        "  ❌ INVARIANT VIOLATION: Some version conflicts could not be resolved",
      );
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log("\nCleaning up test data...");
  await db.execute(
    sql`DELETE FROM transaction_log WHERE source = 'econ-check'`,
  );
  await db.execute(
    sql`DELETE FROM character_wallets WHERE character_id IN (SELECT id FROM characters WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@econ.test'))`,
  );
  await db.execute(
    sql`DELETE FROM characters WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@econ.test')`,
  );
  await db.execute(
    sql`DELETE FROM users WHERE email LIKE '%@econ.test'`,
  );
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
