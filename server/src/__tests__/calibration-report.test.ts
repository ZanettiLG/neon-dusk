import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resetRounds } from "./helpers";

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