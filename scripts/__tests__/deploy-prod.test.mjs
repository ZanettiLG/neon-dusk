/* global process */
// Testes do script de deploy de produção (#61, #65): scripts/deploy-prod.sh.
// DRY_RUN=1 imprime os comandos sem executá-los — nenhum docker real é
// chamado. Zero dependências externas:
//   npx vitest run scripts/__tests__/deploy-prod.test.mjs
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
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

describe('deploy-prod.sh', () => {
  it('should exit 0 and run commands in order when DRY_RUN=1', () => {
    const { status, stdout } = runScript({ DRY_RUN: '1' })
    expect(status).toBe(0)
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
      expect(idx).toBeGreaterThan(prev)
      prev = idx
    }
  })

  it('should roll back to previous images with :latest tag by default (no IMAGE_TAG)', () => {
    const { status, stdout } = runScript({
      DRY_RUN: '1',
      PREVIOUS_SERVER_IMAGE: 'abc',
      PREVIOUS_APP_IMAGE: 'def',
      FORCE_SMOKE_FAIL: '1',
    })
    expect(status).toBe(1)
    const tagServer = stdout.indexOf('docker tag abc ghcr.io/zan-ia/neon-dusk-server:latest')
    const tagApp = stdout.indexOf('docker tag def ghcr.io/zan-ia/neon-dusk-app:latest')
    const rollbackUp = stdout.indexOf('up -d\n') // up -d final do rollback (sem --remove-orphans)
    expect(tagServer).toBeGreaterThan(-1)
    expect(tagApp).toBeGreaterThan(tagServer)
    expect(rollbackUp).toBeGreaterThan(tagApp)
  })

  it('should roll back to previous images with IMAGE_TAG when set (staging)', () => {
    const { status, stdout } = runScript({
      DRY_RUN: '1',
      IMAGE_TAG: 'homolog',
      PREVIOUS_SERVER_IMAGE: 'abc',
      PREVIOUS_APP_IMAGE: 'def',
      FORCE_SMOKE_FAIL: '1',
    })
    expect(status).toBe(1)
    const tagServer = stdout.indexOf('docker tag abc ghcr.io/zan-ia/neon-dusk-server:homolog')
    const tagApp = stdout.indexOf('docker tag def ghcr.io/zan-ia/neon-dusk-app:homolog')
    const rollbackUp = stdout.indexOf('up -d\n')
    expect(tagServer).toBeGreaterThan(-1)
    expect(tagApp).toBeGreaterThan(tagServer)
    expect(rollbackUp).toBeGreaterThan(tagApp)
    expect(stdout).not.toMatch(/docker tag .*:latest/)
  })

  it('should not docker tag when no PREVIOUS_* (first deploy rollback is no-op)', () => {
    const { status, stdout } = runScript({ DRY_RUN: '1', FORCE_SMOKE_FAIL: '1' })
    expect(status).toBe(1)
    expect(stdout).toMatch(/Rolling back/)
    expect(stdout).not.toMatch(/docker tag/)
  })

  it('should exit 1 with clear message when .env.production is missing', () => {
    const { status, stdout } = runScript({ DRY_RUN: '1' }, { withEnvFile: false })
    expect(status).toBe(1)
    expect(stdout).toMatch(/ERROR: \.env\.production not found/)
    expect(stdout).not.toMatch(/docker compose/)
  })

  it('should serialize deploys with flock before capturing previous images', () => {
    const src = readFileSync(SCRIPT, 'utf8')
    const flockIdx = src.indexOf('flock 9')
    const lockIdx = src.indexOf('neondusk-deploy.lock')
    const captureIdx = src.indexOf('capture_previous_images')
    expect(flockIdx).toBeGreaterThan(-1)
    expect(lockIdx).toBeGreaterThan(-1)
    expect(flockIdx).toBeLessThan(captureIdx)
  })

  it('should have valid bash syntax (bash -n)', () => {
    const stdout = execFileSync('bash', ['-n', SCRIPT], { encoding: 'utf8' })
    expect(stdout).toBe('')
  })
})