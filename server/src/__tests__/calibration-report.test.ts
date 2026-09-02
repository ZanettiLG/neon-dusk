import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resetRounds } from "./helpers";
import { aggregateRound, type TypeRow } from "../lib/calibration-report";

// ND-018 — scripts/calibration-report.ts smoke test. Spawns the script as a
// child process against the test DB (DATABASE_URL from setup.ts): validates
// that it boots, resolves imports, parses --round and handles both the
// not-found path (exit 1) and the report path (exit 0).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCRIPT = join(ROOT, "scripts", "calibration-report.ts");
const TSX = join(ROOT, "node_modules", ".bin", "tsx");

function runReport(args: string[]): { status: number; output: string } {
  try {
    const output = execFileSync(TSX, [SCRIPT, ...args], {
      env: { ...process.env }, // DATABASE_URL aponta para o stack de teste (setup.ts)
      encoding: "utf8",
    });
    return { status: 0, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("scripts/calibration-report.ts", () => {
  it("should exit 1 with a clear message when the round does not exist", () => {
    const { status, output } = runReport(["--round", "999999"]);
    expect(status).toBe(1);
    expect(output).toMatch(/no round found/);
  });

  it("should print the report and exit 0 for an existing round", async () => {
    await resetRounds(); // rodada 1 ativa e determinística (started_at = now)
    const { status, output } = runReport(["--round", "1"]);
    expect(status).toBe(0);
    expect(output).toMatch(/ND-018 CALIBRATION REPORT/);
    expect(output).toMatch(/Round: 1/);
  });
});

// Pure aggregation (server/src/lib/calibration-report.ts) — no DB needed.
describe("aggregateRound", () => {
  it("should total faucets/sinks, net and sink ratio from known fixtures", () => {
    const txns: TypeRow[] = [
      { type: "GIG_PAYOUT", n: 2, total: 1000 },
      { type: "PVP_REWARD", n: 1, total: 500 },
      { type: "ADMIN_ADJUSTMENT", n: 1, total: 200 }, // grant (system faucet)
      { type: "VENDOR_PURCHASE", n: 3, total: -300 }, // sink (negative amount)
      { type: "THERAPY_PAYMENT", n: 1, total: -120 }, // sink
      { type: "UNLISTED_TYPE", n: 1, total: 42 }, // neither faucet nor sink
    ];

    const agg = aggregateRound(txns, { txCount: 0, balSum: 0 });

    // 1000 + 500 + 200 grant
    expect(agg.faucetTotal).toBe(1700);
    // abs(-300) + abs(-120)
    expect(agg.sinkTotal).toBe(420);
    expect(agg.net).toBe(1280);
    expect(agg.sinkRatio).toBeCloseTo(420 / 1700, 5);
    // Faucets list only includes types present in the txns; grant is surfaced
    // separately (CREW_BONUS absent from the fixture, correctly omitted).
    expect(agg.faucets.map((r) => r.type)).toEqual(["GIG_PAYOUT", "PVP_REWARD"]);
    expect(agg.grant?.total).toBe(200);
    expect(agg.others.map((r) => r.type)).toEqual(["UNLISTED_TYPE"]);
  });

  it("should report resetIntact=true when the boundary ledger and wallets are empty", () => {
    const agg = aggregateRound([], { txCount: 0, balSum: 0 });
    expect(agg.resetIntact).toBe(true);
    expect(agg.faucetTotal).toBe(0);
    expect(agg.sinkTotal).toBe(0);
    expect(agg.net).toBe(0);
    expect(agg.sinkRatio).toBe(0); // no faucets → ratio 0, no division by zero
  });

  it("should report resetIntact=false when post-reset activity exists", () => {
    expect(aggregateRound([], { txCount: 3, balSum: 250 }).resetIntact).toBe(false);
    expect(aggregateRound([], { txCount: 0, balSum: 1 }).resetIntact).toBe(false);
    expect(aggregateRound([], { txCount: 1, balSum: 0 }).resetIntact).toBe(false);
  });

  it("should treat sink totals by absolute value regardless of amount sign", () => {
    const txns: TypeRow[] = [
      { type: "GIG_PAYOUT", n: 1, total: 600 },
      { type: "CHROME_PURCHASE", n: 1, total: -600 },
    ];
    const agg = aggregateRound(txns, { txCount: 0, balSum: 0 });
    expect(agg.faucetTotal).toBe(600);
    expect(agg.sinkTotal).toBe(600);
    expect(agg.net).toBe(0);
    expect(agg.sinkRatio).toBe(1);
  });
});
