/* global process */
// Testes do wrapper de staging (#65): scripts/deploy-staging.sh.
// O wrapper é fino: IMAGE_TAG="${IMAGE_TAG:-homolog}" exec deploy-prod.sh.
// DRY_RUN=1 propaga para o deploy-prod.sh — nenhum docker real é chamado.
//   npx vitest run scripts/__tests__/deploy-staging.test.mjs
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'deploy-staging.sh')

/** Roda o wrapper com env controlado num tempdir; devolve { status, stdout }. */
function runScript(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-staging-'))
  try {
    writeFileSync(join(dir, '.env.production'), '')
    try {
      const stdout = execFileSync('bash', [SCRIPT], {
        cwd: dir,
        env: { ...process.env, ...env },
        encoding: 'utf8',
      })
      return { status: 0, stdout }
    } catch (err) {
      // exit 1 esperado (rollback) — captura status e stdout.
      return { status: err.status ?? 1, stdout: err.stdout ?? '' }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('deploy-staging.sh', () => {
  it('should delegate to deploy-prod.sh with IMAGE_TAG=homolog by default', () => {
    // FORCE_SMOKE_FAIL + PREVIOUS_* forçam o rollback: prova que o
    // deploy-prod.sh rodou E que IMAGE_TAG=homolog chegou até o docker tag.
    const { status, stdout } = runScript({
      DRY_RUN: '1',
      PREVIOUS_SERVER_IMAGE: 'abc',
      PREVIOUS_APP_IMAGE: 'def',
      FORCE_SMOKE_FAIL: '1',
    })
    expect(status).toBe(1)
    // Deploy-prod.sh executou (comandos canônicos presentes):
    expect(stdout).toContain('up -d --wait postgres redis')
    expect(stdout).toContain('/app/node_modules/.bin/knex --knexfile knexfile.ts migrate:latest')
    // IMAGE_TAG=homolog propagou até o rollback:
    expect(stdout).toContain('docker tag abc ghcr.io/zan-ia/neon-dusk-server:homolog')
    expect(stdout).toContain('docker tag def ghcr.io/zan-ia/neon-dusk-app:homolog')
    expect(stdout).not.toMatch(/docker tag .*:latest/)
  })

  it('should respect a custom IMAGE_TAG', () => {
    const { status, stdout } = runScript({
      DRY_RUN: '1',
      IMAGE_TAG: 'canary',
      PREVIOUS_SERVER_IMAGE: 'abc',
      PREVIOUS_APP_IMAGE: 'def',
      FORCE_SMOKE_FAIL: '1',
    })
    expect(status).toBe(1)
    expect(stdout).toContain('docker tag abc ghcr.io/zan-ia/neon-dusk-server:canary')
    expect(stdout).toContain('docker tag def ghcr.io/zan-ia/neon-dusk-app:canary')
  })

  it('should have valid bash syntax (bash -n)', () => {
    const stdout = execFileSync('bash', ['-n', SCRIPT], { encoding: 'utf8' })
    expect(stdout).toBe('')
  })
})