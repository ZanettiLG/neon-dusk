/* global process */
// Teste do guard de terminologia (#145): roda scripts/check-terminologia.mjs
// contra fixtures controladas em tempdir via TERMINOLOGIA_ROOTS (override de
// ROOTS+CODE_ROOTS). Zero dependências: node --test scripts/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
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
      mkdirSync(dirname(join(dir, name)), { recursive: true })
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

test('should exit 0 on banned term inside server/migrations (immutable history)', () => {
  // Migrações aplicadas são histórico imutável (#169): o guard não as varre.
  // O mesmo conteúdo fora de migrations já é coberto pelo teste "eddies" acima.
  const { status, stdout } = runGuard({
    'server/migrations/010-applied.ts':
      "// migration aplicada\nconst msg = 'Pagou 50 eddies na hora';\n",
  })
  assert.equal(status, 0, `stdout: ${stdout}`)
})

test('should exit 1 on banned term in subdir with similar name (suffix match boundary)', () => {
  // Fronteira do sufixo: apenas o path exato server/migrations é excluído.
  // Um vizinho homônimo (migrations2) deve continuar varrido.
  const { status, stdout } = runGuard({
    'server/migrations2/bad.ts': "const msg = 'Pagou 50 eddies na hora';\n",
  })
  assert.equal(status, 1)
  assert.match(stdout, /bad\.ts:1:eddies/)
})

// ─── Extensão #180: termos canônicos limpos nos cards #165-#167/#179 ───────

test('should exit 1 with the six #180 labels on user-facing prose', () => {
  const { status, stdout } = runGuard({
    'bad-gig.ts': "const msg = 'Aceitou a gig na hora';\n",
    'bad-chrome.ts': "const msg = 'Implante de chrome';\n",
    'bad-stim.ts': "const msg = 'stim barato na esquina';\n",
    'bad-kiroshi.ts': "const msg = 'Óptica Kiroshi instalada';\n",
    'bad-syn.ts': "const msg = 'Um syn-café pra acordar';\n",
    'bad-gorilla.ts': "const msg = 'Gorilla Arms de titânio';\n",
  })
  assert.equal(status, 1)
  for (const [file, label] of [
    ['bad-gig', 'gig'],
    ['bad-chrome', 'chrome (implantes)'],
    ['bad-stim', 'stim'],
    ['bad-kiroshi', 'kiroshi'],
    ['bad-syn', 'syn-café'],
    ['bad-gorilla', 'gorilla arms'],
  ]) {
    assert.match(stdout, new RegExp(`${file}\\.ts:1:${label.replace('(', '\\(').replace(')', '\\)')}`))
  }
})

test('should exit 0 on #180 internal tokens (routes, enum strings, itemIds, SQL table)', () => {
  // Tokens ancorados à esquerda por aspas/backtick/slash/dois-pontos/hífen —
  // nunca prosa ("aceitou a gig" tem espaço antes do termo e segue banido).
  const { status, stdout } = runGuard({
    'tokens-180.ts': [
      "export const ROUTES = ['/api/gigs', '/api/chrome', '/api/chrome/install']",
      "export const TYPES = ['gig', 'GIGS', 'CHROME', 'CONSUMABLE']",
      "export const ITEMS = ['kiroshi-optics', 'syn-cafe', 'combat-stim']",
      "export const KEY = `nil:stim:${'id'}`",
      "export const SQL = 'TRUNCATE TABLE gigs, chrome_definitions CASCADE'",
      "export const TABLE = db('gigs')",
      '',
    ].join('\n'),
  })
  assert.equal(status, 0, `stdout: ${stdout}`)
})

test('should exit 0 on #180 embedded identifiers and field declarations', () => {
  const { status, stdout } = runGuard({
    'ids-180.ts': [
      'export function useGigStore(gigId: string) { return gigId }',
      'export const chromePower = 5',
      'export const totalGigSuccessBonus = (gig_success_rate: number) => gig_success_rate',
      'export interface Board { gigs: unknown[]; chrome: number; activeGig?: unknown }',
      '',
    ].join('\n'),
  })
  assert.equal(status, 0, `stdout: ${stdout}`)
})

test('should not let an embedded identifier mask a bare violation on the same line (#180 multi-match)', () => {
  // Um identificador embutido no início da linha (calculateChromePower) não
  // pode esconder uma ocorrência solta mais adiante na mesma linha.
  const { status, stdout } = runGuard({
    'mask.ts': 'expect(calculateChromePower([implant({})])).toBe(0); const msg = "implante de chrome";\n',
  })
  assert.equal(status, 1)
  assert.match(stdout, /mask\.ts:1:chrome \(implantes\)/)
})

test('should exit 1 when "kiroshi optics" prose leaks through the itemId allowlist (#180 review)', () => {
  // O itemId interno é sempre citado ("kiroshi-optics"); a allowlist é
  // ancorada nos dois lados, então prosa ("kiroshi optics na promoção")
  // não pode mais ser eximida pelo token.
  const { status, stdout } = runGuard({
    'kiroshi-leak.ts': '// kiroshi optics na promoção da semana\n',
  })
  assert.equal(status, 1)
  assert.match(stdout, /kiroshi-leak\.ts:1:kiroshi/)
})

test('should keep exempting the declaration allowlist for "const gig: GigListItem" (#180 review regression)', () => {
  // Regressão do finding 2: a allowlist de declaração de campo continua
  // eximindo a linha de declaração (comportamento preservado).
  const { status, stdout } = runGuard({
    'decl-gig.ts': 'const gig: GigListItem = row;\n',
  })
  assert.equal(status, 0, `stdout: ${stdout}`)
})
