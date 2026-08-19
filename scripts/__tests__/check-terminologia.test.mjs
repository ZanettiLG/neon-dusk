/* global process */
// Teste do guard de terminologia (#145): roda scripts/check-terminologia.mjs
// contra fixtures controladas em tempdir via TERMINOLOGIA_ROOTS (override de
// ROOTS+CODE_ROOTS). Zero dependências: node --test scripts/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARD = join(ROOT, 'scripts', 'check-terminologia.mjs')

/** Roda o guard contra fixtures {nome: conteúdo}; devolve { status, stdout }. */
function runGuard(fixtures) {
  const dir = mkdtempSync(join(tmpdir(), 'terminologia-'))
  try {
    for (const [name, content] of Object.entries(fixtures)) {
      writeFileSync(join(dir, name), content)
    }
    try {
      const stdout = execFileSync(process.execPath, [GUARD], {
        cwd: ROOT,
        env: { ...process.env, TERMINOLOGIA_ROOTS: dir },
        encoding: 'utf8',
      })
      return { status: 0, stdout }
    } catch (err) {
      // exit 1 esperado (self-check ou violação) — captura status e stdout.
      return { status: err.status ?? 1, stdout: err.stdout ?? '' }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('should exit 1 with label "eddies" on user-facing prose', () => {
  const { status, stdout } = runGuard({
    'bad-prose.ts': "const msg = 'Pagou 50 eddies na hora';\n",
  })
  assert.equal(status, 1)
  assert.match(stdout, /bad-prose\.ts:1:eddies/)
})

test('should exit 1 with label "street cred" on user-facing prose', () => {
  const { status, stdout } = runGuard({
    'bad-ui.ts': "export const LABEL = 'Ganhou Street Cred na rua';\n",
  })
  assert.equal(status, 1)
  assert.match(stdout, /bad-ui\.ts:1:street cred/)
})

test('should exit 0 on internal tokens (field declaration, ALLCAPS enum value)', () => {
  const { status, stdout } = runGuard({
    'tokens.ts': "export interface Wallet { eddies: number }\nexport const VT = 'RIPPERDOC';\n",
  })
  assert.equal(status, 0, `stdout: ${stdout}`)
})

test('should exit 0 on word-boundary: embedded identifier passes', () => {
  const { status, stdout } = runGuard({
    'metrics.ts': 'export function totalEddiesEarned() { return 0 }\n',
  })
  assert.equal(status, 0, `stdout: ${stdout}`)
})

test('should honor caseSensitive class rules: Title-case Netrunner fails, lowercase token passes', () => {
  // (a) "Netrunner" Title-case em prosa user-facing → violação com label Netrunner.
  const prose = runGuard({
    'netrunner-prose.ts': 'A Netrunner invadiu o servidor.\n',
  })
  assert.equal(prose.status, 1)
  assert.match(prose.stdout, /netrunner-prose\.ts:1:Netrunner/)

  // (b) "netrunner" lowercase como token interno (enum/role) → passa.
  const token = runGuard({
    'role-internal.ts': "role: 'netrunner'\n",
  })
  assert.equal(token.status, 0, `stdout: ${token.stdout}`)
})

// Self-check de probe morta não é injetável sem editar o guard; fica coberto
// por transitividade: o self-check roda no início de TODA execução do guard
// (inclusive nos testes acima e no CI), abortando com exit 1 se um probe
// deixar de disparar — o que falharia os testes (b)/(c) que esperam exit 0.
