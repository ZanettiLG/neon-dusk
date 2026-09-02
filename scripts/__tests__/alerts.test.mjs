// ND-018: prometheus/alerts.yml — YAML syntax + metric names aligned with
// server/src/telemetry/metrics.ts. Zero DB/docker:
//   node --test scripts/__tests__/alerts.test.mjs
// js-yaml is a transitive dep (via @eslint/eslintrc) — if it ever leaves the
// tree, swap the parse for a structural check or add it as a devDependency.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ALERTS = join(ROOT, "prometheus", "alerts.yml");
const METRICS_SRC = join(ROOT, "server", "src", "telemetry", "metrics.ts");

test("alerts.yml should be valid YAML with the expected alert rules", () => {
  const doc = yaml.load(readFileSync(ALERTS, "utf8"));
  assert.ok(doc && typeof doc === "object", "alerts.yml must parse to an object");
  const groups = doc.groups;
  assert.ok(Array.isArray(groups) && groups.length >= 1, "must have at least one group");
  const rules = groups.flatMap((g) => g.rules ?? []);
  assert.ok(rules.length >= 3, "must define at least 3 alert rules");

  const names = rules.map((r) => r.alert);
  for (const expected of [
    "NeonDuskServerDown",
    "NeonDuskZeroActiveCharacters",
    "NeonDuskHighErrorRate",
  ]) {
    assert.ok(names.includes(expected), `missing alert ${expected}`);
  }
  for (const r of rules) {
    assert.ok(typeof r.expr === "string" && r.expr.length > 0, `${r.alert} must have an expr`);
    assert.ok(typeof r.for === "string" && r.for.length > 0, `${r.alert} must have a for duration`);
    assert.ok(
      typeof r.labels?.severity === "string" && r.labels.severity.length > 0,
      `${r.alert} must have a severity label`,
    );
  }
});

test("alert metric names should be registered in telemetry/metrics.ts", () => {
  const doc = yaml.load(readFileSync(ALERTS, "utf8"));
  const used = new Set();
  for (const rule of doc.groups.flatMap((g) => g.rules)) {
    for (const m of (rule.expr ?? "").matchAll(/\bneondusk_[a-z_]+/g)) used.add(m[0]);
  }
  assert.ok(used.size > 0, "alerts.yml must reference at least one neondusk_* metric");

  const src = readFileSync(METRICS_SRC, "utf8");
  const registered = new Set([...src.matchAll(/name:\s*"([a-z_]+)"/g)].map((m) => m[1]));
  for (const metric of used) {
    assert.ok(
      registered.has(metric),
      `metric "${metric}" used in alerts.yml is not registered in metrics.ts`,
    );
  }
});