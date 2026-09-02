// #65: .github/workflows/homolog-deploy.yml — deploy release-gated via branch
// homolog. Validação estrutural: trigger, concurrency, permissions, tags de
// build (:homolog, nunca :latest), promoção latest DEPOIS do deploy, e ausência
// de jobs de teste. Zero rede/docker:
//   npx vitest run scripts/__tests__/homolog-deploy-workflow.test.mjs
// js-yaml é dep transitiva (via @eslint/eslintrc) — mesmo padrão de
// alerts.test.mjs / prometheus-config.test.mjs.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WORKFLOW = join(ROOT, '.github', 'workflows', 'homolog-deploy.yml')

function loadWorkflow() {
  const doc = yaml.load(readFileSync(WORKFLOW, 'utf8'))
  expect(doc).toBeTruthy()
  return doc
}

function allSteps(doc) {
  return Object.values(doc.jobs).flatMap((job) => job.steps ?? [])
}

describe('homolog-deploy.yml', () => {
  it('should trigger ONLY on push to homolog (no pull_request, no main)', () => {
    const doc = loadWorkflow()
    expect(doc.on.push.branches).toEqual(['homolog'])
    expect(doc.on.pull_request).toBeUndefined()
    expect(doc.on.push.branches).not.toContain('main')
  })

  it('should serialize deploys with concurrency group homolog-deploy (no cancel)', () => {
    const doc = loadWorkflow()
    expect(doc.concurrency.group).toBe('homolog-deploy')
    expect(doc.concurrency['cancel-in-progress']).toBe(false)
  })

  it('should grant packages: write permission', () => {
    const doc = loadWorkflow()
    expect(doc.permissions.packages).toBe('write')
  })

  it('should build server and app with :homolog tag (never :latest)', () => {
    const doc = loadWorkflow()
    const builds = allSteps(doc).filter((s) => s.uses?.startsWith('docker/build-push-action'))
    expect(builds.length).toBe(2)
    for (const step of builds) {
      expect(step.with.tags).toContain(':homolog')
      expect(step.with.tags).not.toContain(':latest')
    }
  })

  it('should promote homolog to :latest AFTER the staging deploy step', () => {
    const doc = loadWorkflow()
    const steps = Object.values(doc.jobs)[0].steps
    const deployIdx = steps.findIndex((s) => s.name === 'Deploy staging via SSH')
    const promoteIdx = steps.findIndex((s) => (s.run ?? '').includes('imagetools create'))
    expect(deployIdx).toBeGreaterThan(-1)
    expect(promoteIdx).toBeGreaterThan(deployIdx)
    const promote = steps[promoteIdx]
    expect(promote.run).toContain('ghcr.io/zan-ia/neon-dusk-server:latest')
    expect(promote.run).toContain('ghcr.io/zan-ia/neon-dusk-app:latest')
    expect(promote.run).toContain('ghcr.io/zan-ia/neon-dusk-server:homolog')
  })

  it('should NOT run any test jobs (no npm test/vitest/playwright)', () => {
    const doc = loadWorkflow()
    for (const step of allSteps(doc)) {
      expect(step.run ?? '').not.toMatch(/npm test|vitest|playwright/)
    }
    expect(Object.keys(doc.jobs).some((n) => /test/i.test(n))).toBe(false)
  })
})