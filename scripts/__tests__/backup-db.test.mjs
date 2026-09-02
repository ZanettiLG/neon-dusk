/* global process */
// Testes do script de backup de produção (ND-018): scripts/backup-db.sh.
// DRY_RUN=1 imprime os comandos sem executá-los — nenhum docker real é
// chamado. Zero dependências: node --test scripts/__tests__/backup-db.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(ROOT, "scripts", "backup-db.sh");

/** Roda o script com env controlado num tempdir; devolve { status, stdout }. */
function runScript(env = {}, { withEnvFile = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "backup-db-"));
  try {
    if (withEnvFile) writeFileSync(join(dir, ".env.production"), "");
    try {
      const stdout = execFileSync("bash", [SCRIPT], {
        cwd: dir,
        // BACKUP_DIR aponta para o tempdir — o caminho absoluto /opt/neon-dusk
        // é da VPS e não existe aqui.
        env: { ...process.env, ...env, BACKUP_DIR: join(dir, "backups") },
        encoding: "utf8",
      });
      return { status: 0, stdout };
    } catch (err) {
      // exit 1 esperado (backup vazio/pre-flight) — captura status e stdout.
      return { status: err.status ?? 1, stdout: err.stdout ?? "" };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("should exit 0 and run pg_dump → gzip → prune in order when DRY_RUN=1", () => {
  const { status, stdout } = runScript({ DRY_RUN: "1" });
  assert.equal(status, 0, `stdout: ${stdout}`);
  const order = [
    "exec -T postgres", // pg_dump roda no container postgres
    "pg_dump -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\"", // dump
    "gzip", // compactação
    "ls -1t", // prune (mais recentes primeiro)
  ];
  let prev = -1;
  for (const cmd of order) {
    const idx = stdout.indexOf(cmd);
    assert.ok(idx > prev, `"${cmd}" ausente ou fora de ordem:\n${stdout}`);
    prev = idx;
  }
});

test("should exit 1 with a clear message when the backup file is empty", () => {
  const { status, stdout } = runScript({ DRY_RUN: "1", FORCE_EMPTY_BACKUP: "1" });
  assert.equal(status, 1);
  assert.match(stdout, /ERROR: backup file is empty/);
  assert.doesNotMatch(stdout, /Backup complete/);
});

test("should print commands without executing them under DRY_RUN", () => {
  const { status, stdout } = runScript({ DRY_RUN: "1" });
  // status 0 é a prova de não-execução: um `docker compose --env-file
  // .env.production -f docker-compose.prod.yml exec` real no tempdir (sem o
  // compose file) falharia com exit != 0.
  assert.equal(status, 0);
  assert.match(stdout, /\+ docker compose --env-file \.env\.production/);
});

test("should exit 1 with clear message when .env.production is missing", () => {
  const { status, stdout } = runScript({ DRY_RUN: "1" }, { withEnvFile: false });
  assert.equal(status, 1);
  assert.match(stdout, /ERROR: \.env\.production not found/);
  assert.doesNotMatch(stdout, /docker compose/);
});

test("should have valid bash syntax (bash -n)", () => {
  const stdout = execFileSync("bash", ["-n", SCRIPT], { encoding: "utf8" });
  assert.equal(stdout, "");
});

test("should prune to the 7 most recent backups (KEEP=7)", () => {
  const dir = mkdtempSync(join(tmpdir(), "backup-db-prune-"));
  try {
    writeFileSync(join(dir, ".env.production"), "");
    // Fake docker: emits fake dump data so the size guard passes — no real
    // docker/compose needed (the script's compose() resolves via PATH).
    const bin = join(dir, "bin");
    mkdirSync(bin);
    writeFileSync(
      join(bin, "docker"),
      "#!/usr/bin/env bash\ncat <<'EOF'\nfake dump data\nEOF\n",
      { mode: 0o755 },
    );

    const backups = join(dir, "backups");
    mkdirSync(backups);
    const now = Date.now();
    for (let i = 1; i <= 10; i++) {
      const f = join(backups, `neondusk-2026010${i}-000000.sql.gz`);
      writeFileSync(f, "old");
      // mtime = now − i days: the 4 oldest (i=7..10) must be pruned.
      utimesSync(f, new Date(now - i * 86_400_000), new Date(now - i * 86_400_000));
    }

    const stdout = execFileSync("bash", [SCRIPT], {
      cwd: dir,
      env: { ...process.env, BACKUP_DIR: backups, PATH: `${bin}:${process.env.PATH}` },
      encoding: "utf8",
    });

    const remaining = readdirSync(backups).filter((f) => f.endsWith(".sql.gz"));
    // 10 pre-created + 1 new = 11 → prune keeps the 7 newest.
    assert.equal(remaining.length, 7, `stdout: ${stdout}`);
    for (let i = 7; i <= 10; i++) {
      assert.ok(
        !remaining.includes(`neondusk-2026010${i}-000000.sql.gz`),
        `backup ${i} should have been pruned`,
      );
    }
    // The 6 newest pre-created (i=1..6) survive alongside the new dump.
    for (let i = 1; i <= 6; i++) {
      assert.ok(remaining.includes(`neondusk-2026010${i}-000000.sql.gz`));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});