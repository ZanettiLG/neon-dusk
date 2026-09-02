// ND-007: prometheus/prometheus.yml + prometheus/prometheus.prod.yml — scrape
// targets must be hardcoded host:port. Prometheus config does NOT expand
// ${VAR:-default} (env-substitution exists only for external_labels), so a
// literal "${SCRAPE_TARGET:-...}" target would alert forever. Zero DB/docker:
//   node --test scripts/__tests__/prometheus-config.test.mjs
// js-yaml is a transitive dep (via @eslint/eslintrc) — if it ever leaves the
// tree, swap the parse for a structural check or add it as a devDependency.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONFIGS = [
  join(ROOT, "prometheus", "prometheus.yml"),
  join(ROOT, "prometheus", "prometheus.prod.yml"),
];
const TARGET_RE = /^[\w.-]+:\d+$/;

test("scrape targets should be hardcoded host:port (no ${...} expansion)", () => {
  for (const file of CONFIGS) {
    const doc = yaml.load(readFileSync(file, "utf8"));
    const targets = doc.scrape_configs.flatMap((c) => c.static_configs).flatMap((s) => s.targets);
    assert.ok(targets.length >= 1, `${file} must define at least one scrape target`);
    for (const t of targets) {
      assert.ok(typeof t === "string", `${file}: target must be a string`);
      assert.ok(!t.includes("${"), `${file}: target "${t}" must not contain env-substitution`);
      assert.match(t, TARGET_RE, `${file}: target "${t}" must look like host:port`);
    }
  }
});