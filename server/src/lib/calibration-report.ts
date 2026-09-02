import { ECONOMY_FAUCET_TYPES, ECONOMY_SINK_TYPES } from "../repositories/transaction-repository";

// Neon Dusk — Calibration report aggregation (ND-018)
// ============================================================================
// Pure economy aggregation for scripts/calibration-report.ts: faucet vs sink
// totals, net, sink ratio and the post-reset ledger wipe check. No DB access —
// callers pass the per-type transaction aggregates and the boundary counts.

/** Per-type aggregate row (from transaction_log GROUP BY type). */
export interface TypeRow {
  type: string;
  n: number;
  total: number;
}

/** Post-reset boundary counts used by the inflation check. */
export interface ResetBoundary {
  txCount: number;
  balSum: number;
}

/** Aggregate result consumed by the CLI report. */
export interface RoundAggregate {
  faucets: Array<TypeRow & { type: string }>;
  sinks: Array<TypeRow & { type: string }>;
  grant: TypeRow | undefined;
  others: TypeRow[];
  faucetTotal: number;
  sinkTotal: number;
  net: number;
  sinkRatio: number;
  resetIntact: boolean;
}

/**
 * Aggregate a round's economy from per-type transaction totals and the
 * post-reset boundary counts. Pure — no DB access.
 *
 * Faucet/sink membership uses the real type lists from
 * transaction-repository; ADMIN_ADJUSTMENT is treated as the system grant
 * (faucet). `resetIntact` is true only when the ledger and wallets were
 * wiped at the round boundary (both counts zero).
 */
export function aggregateRound(typeRows: TypeRow[], reset: ResetBoundary): RoundAggregate {
  const byType = new Map(typeRows.map((r) => [r.type, r]));

  const faucets = ECONOMY_FAUCET_TYPES.map((t) => ({ type: t, ...byType.get(t) })).filter(
    (r) => r.n !== undefined,
  ) as Array<TypeRow & { type: string }>;
  const sinks = ECONOMY_SINK_TYPES.map((t) => ({ type: t, ...byType.get(t) })).filter(
    (r) => r.n !== undefined,
  ) as Array<TypeRow & { type: string }>;
  // Grant inicial / ajustes administrativos (wallet.ensure registra
  // ADMIN_ADJUSTMENT no seed capital).
  const grant = byType.get("ADMIN_ADJUSTMENT");
  const others = typeRows.filter(
    (r) =>
      !(ECONOMY_FAUCET_TYPES as readonly string[]).includes(r.type) &&
      !(ECONOMY_SINK_TYPES as readonly string[]).includes(r.type) &&
      r.type !== "ADMIN_ADJUSTMENT",
  );

  const faucetTotal = faucets.reduce((s, r) => s + r.total, 0) + (grant?.total ?? 0);
  const sinkTotal = sinks.reduce((s, r) => s + Math.abs(r.total), 0);
  const net = faucetTotal - sinkTotal;
  const sinkRatio = faucetTotal > 0 ? sinkTotal / faucetTotal : 0;
  const resetIntact = reset.txCount === 0 && reset.balSum === 0;

  return { faucets, sinks, grant, others, faucetTotal, sinkTotal, net, sinkRatio, resetIntact };
}
