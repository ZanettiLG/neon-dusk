/* global process */
// Testes do script de deploy de produção (#61): scripts/deploy-prod.sh.
// DRY_RUN=1 imprime os comandos sem executá-los — nenhum docker real é
// chamado. Zero dependências: node --test scripts/__tests__/deploy-prod.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'deploy-prod.sh')

/** Roda o script com env controlado num tempdir; devolve { status, stdout }. */
function runScript(env = {}, { withEnvFile = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-prod-'))
  try {
    if (withEnvFile) writeFileSync(join(dir, '.env.production'), '')
    try {
      const stdout = execFileSync('bash', [SCRIPT], {
        cwd: dir,
        env: { ...process.env, ...env },
        encoding: 'utf8',
      })
      return { status: 0, stdout }
    } catch (err) {
      // exit 1 esperado (rollback/pre-flight) — captura status e stdout.
      return { status: err.status ?? 1, stdout: err.stdout ?? '' }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('should exit 0 and run commands in order when DRY_RUN=1', () => {
  const { status, stdout } = runScript({ DRY_RUN: '1' })
  assert.equal(status, 0, `stdout: ${stdout}`)
  const order = [
    'up -d --wait postgres redis', // [1/6] infra
    'pull', // [2/6]
    '--workdir /app/server', // [3/6] migrate roda no server image
    '/app/node_modules/.bin/knex --knexfile knexfile.ts migrate:latest', // [3/6] knex CLI
    'up -d --remove-orphans', // [4/6]
    'curl -sf http://localhost/ -o /dev/null', // [5/6] smoke app
    'curl -sf http://localhost/api/health -o /dev/null', // [5/6] smoke api
    'docker image prune -af', // [6/6]
  ]
  let prev = -1
  for (const cmd of order) {
    const idx = stdout.indexOf(cmd)
    assert.ok(idx > prev, `"${cmd}" ausente ou fora de ordem:\n${stdout}`)
    prev = idx
  }
})

test('should roll back to previous images when smoke fails and PREVIOUS_* set', () => {
  const { status, stdout } = runScript({
    DRY_RUN: '1',
    PREVIOUS_SERVER_IMAGE: 'abc',
    PREVIOUS_APP_IMAGE: 'def',
    FORCE_SMOKE_FAIL: '1',
  })
  assert.equal(status, 1)
  const tagServer = stdout.indexOf('docker tag abc ghcr.io/zan-ia/neon-dusk-server:latest')
  const tagApp = stdout.indexOf('docker tag def ghcr.io/zan-ia/neon-dusk-app:latest')
  const rollbackUp = stdout.indexOf('up -d\n') // up -d final do rollback (sem --remove-orphans)
  assert.ok(tagServer > -1, `tag server ausente:\n${stdout}`)
  assert.ok(tagApp > tagServer, `tag app ausente ou fora de ordem:\n${stdout}`)
  assert.ok(rollbackUp > tagApp, `up -d final do rollback ausente ou fora de ordem:\n${stdout}`)
})

test('should not docker tag when no PREVIOUS_* (first deploy rollback is no-op)', () => {
  const { status, stdout } = runScript({ DRY_RUN: '1', FORCE_SMOKE_FAIL: '1' })
  assert.equal(status, 1)
  assert.match(stdout, /Rolling back/)
  assert.doesNotMatch(stdout, /docker tag/)
})

test('should exit 1 with clear message when .env.production is missing', () => {
  const { status, stdout } = runScript({ DRY_RUN: '1' }, { withEnvFile: false })
  assert.equal(status, 1)
  assert.match(stdout, /ERROR: \.env\.production not found/)
  assert.doesNotMatch(stdout, /docker compose/)
})

test('should have valid bash syntax (bash -n)', () => {
  const stdout = execFileSync('bash', ['-n', SCRIPT], { encoding: 'utf8' })
  assert.equal(stdout, '')
})