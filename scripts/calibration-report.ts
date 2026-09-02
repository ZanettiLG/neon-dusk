#!/usr/bin/env npx tsx

/**
 * ND-018: Calibration report — economy faucets vs sinks per round.
 *
 * Queries transaction_log within a round window (rounds.started_at →
 * ended_at), groups by transaction type, and compares faucets against sinks
 * against the round's active character count (round_stats). The post-reset
 * inflation check verifies the ledger and wallets were wiped at the reset
 * boundary (count = 0, sum(balance) = 0).
 *
 * The aggregation math lives in server/src/lib/calibration-report.ts
 * (pure, unit-tested); this file is the CLI wrapper that reads the DB and
 * prints the report.
 *
 * Usage:   npx tsx scripts/calibration-report.ts [--round <n>]
 * Default: --round = última rodada encerrada (pós-reset: tabela vazia + check
 *          de inflação). Passe o número da rodada ATIVA para ver a economia
 *          ao vivo.
 * Requires: DB stack running (DATABASE_URL, ex. docker-compose.test.yml).
 */

/* eslint-disable no-console */

import "dotenv/config";
import { db } from "../server/src/db";
import { aggregateRound, type TypeRow } from "../server/src/lib/calibration-report";

// ─── Config / helpers ───────────────────────────────────────────────────────

interface Args {
  round?: number;
}
function parseArgs(argv: string[]): Args {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--round") return { round: Number(argv[i + 1]) };
    if (argv[i].startsWith("--round=")) return { round: Number(argv[i].split("=")[1]) };
  }
  return {};
}

interface RoundRow {
  id: string;
  round_number: number;
  started_at: Date;
  ended_at: Date | null;
  status: string;
}

function fmt(value: number): string {
  return value.toLocaleString("pt-BR");
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { round: roundArg } = parseArgs(process.argv.slice(2));

  console.log("╔══════════════════════════════════════╗");
  console.log("║  ND-018 CALIBRATION REPORT          ║");
  console.log("╚══════════════════════════════════════╝\n");

  // 1. Resolve the target round (default: last ended).
  let round: RoundRow | undefined;
  if (roundArg !== undefined) {
    const rows = await db("rounds").where("round_number", roundArg).limit(1);
    round = rows[0] as RoundRow | undefined;
  } else {
    const rows = await db("rounds")
      .where("status", "ended")
      .orderBy("round_number", "desc")
      .limit(1);
    round = rows[0] as RoundRow | undefined;
  }

  if (!round) {
    console.error("ERROR: no round found (use --round <n> for a specific round).");
    process.exit(1);
  }

  const windowEnd = round.ended_at ?? new Date();
  console.log(`Round: ${round.round_number} (${round.status})`);
  console.log(`Janela: ${round.started_at.toISOString()} → ${windowEnd.toISOString()}\n`);

  // 2. Per-type aggregates inside the round window.
  const typeRows = (await db("transaction_log")
    .select({
      type: "type",
      n: db.raw("count(*)::int"),
      total: db.raw("coalesce(sum(amount), 0)::bigint"),
    })
    .where("created_at", ">=", round.started_at)
    .andWhere("created_at", "<", windowEnd)
    .groupBy("type")) as TypeRow[];

  // 3. Post-reset boundary counts — feeding the pure aggregation (no DB
  // queries inside the math).
  const [preResetTx] = await db("transaction_log")
    .where("created_at", "<=", windowEnd)
    .count({ count: "*" });
  const [preResetBal] = await db("character_wallets")
    .where("updated_at", "<=", windowEnd)
    .sum({ total: "balance" });

  const agg = aggregateRound(typeRows, {
    txCount: Number(preResetTx?.count ?? 0),
    balSum: Number(preResetBal?.total ?? 0),
  });

  // 4. Round stats → active characters for per-character averages.
  const statsRows = await db("round_stats").where("round_id", round.id).limit(1);
  const activeChars = Number(
    (statsRows[0] as { total_active_characters?: number } | undefined)?.total_active_characters ??
      0,
  );

  console.log("─".repeat(46));
  console.log("FLUXO POR TIPO (dentro da janela da rodada)\n");
  console.table([
    ...agg.faucets.map((r) => ({ fluxo: "FAUCET", type: r.type, n: r.n, total: r.total })),
    ...(agg.grant
      ? [
          {
            fluxo: "FAUCET",
            type: "GRANT (ADMIN_ADJUSTMENT)",
            n: agg.grant.n,
            total: agg.grant.total,
          },
        ]
      : []),
    ...agg.sinks.map((r) => ({ fluxo: "SINK", type: r.type, n: r.n, total: -Math.abs(r.total) })),
    ...agg.others.map((r) => ({ fluxo: "OUTRO", type: r.type, n: r.n, total: r.total })),
  ]);

  // 5. Net + sink ratio + per-character averages.
  console.log("─".repeat(46));
  console.log("RESUMO\n");
  console.log(`  Faucets totais (incl. grant):     ${fmt(agg.faucetTotal)} G$`);
  console.log(`  Sinks totais:                     ${fmt(agg.sinkTotal)} G$`);
  console.log(`  Net (faucets − sinks):            ${fmt(agg.net)} G$`);
  console.log(
    `  Sink ratio (sinks / faucets):     ${(agg.sinkRatio * 100).toFixed(1)}%  (meta ≥ 60%)`,
  );
  if (activeChars > 0) {
    console.log(`  Personagens ativos (round_stats):  ${fmt(activeChars)}`);
    console.log(
      `  Faucet por personagem:             ${fmt(Math.round(agg.faucetTotal / activeChars))} G$`,
    );
    console.log(
      `  Sink por personagem:               ${fmt(Math.round(agg.sinkTotal / activeChars))} G$`,
    );
  } else {
    console.log("  Personagens ativos (round_stats):  — (sem round_stats p/ esta rodada)");
  }

  // 6. Post-reset inflation check (verifica o wipe no boundary do reset).
  const preResetTxCount = Number(preResetTx?.count ?? 0);
  const preResetBalSum = Number(preResetBal?.total ?? 0);

  console.log("\n─".repeat(46));
  console.log("VERIFICAÇÃO DE INFLAÇÃO PÓS-RESET\n");
  console.log(`  transaction_log <= fim da rodada:  ${fmt(preResetTxCount)}  (esperado 0)`);
  console.log(`  Σ(wallet.balance) <= fim da rodada: ${fmt(preResetBalSum)}  (esperado 0)`);
  console.log(
    agg.resetIntact
      ? "  ✅ Reset intacto — ledger e wallets zerados no boundary."
      : "  ⚠ Não-zero esperado quando a rodada atual já movimentou grana.",
  );

  console.log("═".repeat(46));
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
