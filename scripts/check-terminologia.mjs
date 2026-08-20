#!/usr/bin/env node
/* global console, process */
/* eslint-disable no-console -- CLI de varredura: violações são a saída */
// Guard de consistência terminológica (issue #136, extensão de contexto PR #147).
// Falha (exit 1) se termos banidos de IP de terceiros reaparecerem nos docs
// OU nas strings de código (extensão #145 — user-facing only: chaves internas
// de schema/API e enum lowercase continuam permitidas).
// Zero dependências: node scripts/check-terminologia.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Override para testes (TERMINOLOGIA_ROOTS): paths separados por vírgula que
// substituem ROOTS e CODE_ROOTS (e dispensam FILES), permitindo rodar o guard
// contra fixtures controladas fora do repo. Default: varredura completa.
const envRoots = process.env.TERMINOLOGIA_ROOTS
  ?.split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const ROOTS = envRoots ?? [
  'docs/definicoes-de-produto',
  'docs/design',
  'docs/prompts',
  '.opencode/agents',
  '.opencode/commands',
  '.opencode/skills',
  'docs/sistema-de-desenvolvimento',
]

// Arquivos de produto soltos (fora dos diretórios ROOTS). Varridos junto:
// prosa de produto também vive na raiz e em docs/ solto (#148).
const FILES = envRoots ? [] : ['README.md', 'docs/BETA_CHECKLIST.md']

// Entradas: { label, re, caseSensitive? } — label para output limpo, regex
// para matching. Por padrão o teste é case-insensitive (a linha é lowercased
// antes); caseSensitive: true testa a linha original — usado apenas para
// nomes de classe que colidem com palavras comuns do PT ("solo" e "tech"
// minúsculas NÃO são banidas; "Solo" e "Tech" como classe sim).
const BANNED = [
  { label: 'sandevistan', re: /sandevistan/ },
  { label: 'gorilla arms', re: /gorilla arms/ },
  { label: 'mantis blades', re: /mantis blades/ },
  { label: 'kiroshi', re: /kiroshi/ },
  { label: 'maxtac', re: /maxtac/ },
  { label: 'trauma team', re: /trauma team/ },
  { label: 'blackwall', re: /blackwall/ },
  { label: 'braindance', re: /braindance/ },
  { label: 'choom', re: /choom/ },
  { label: 'edgerunner', re: /edgerunner/ },
  { label: 'night city', re: /night city/ },
  { label: 'night city legend', re: /night city legend/ },
  { label: 'silverhand', re: /silverhand/ },
  { label: 'afterlife', re: /afterlife/ },
  { label: 'johnny silverhand', re: /johnny silverhand/ },
  { label: 'monowire', re: /monowire/ },
  // word boundary em "berserk": o modo (OS) é banido; "Berserker" (o stim)
  // também é banido e tem entrada própria abaixo.
  { label: 'berserk', re: /\bberserk\b/ },
  // Extensão terminológica (issue #136 / PR #147): termos do Cyberpunk RED
  // substituídos por marca própria.
  { label: 'street cred', re: /street cred/ },
  { label: 'ripperdoc', re: /ripperdoc/ },
  { label: 'eddies', re: /eddies/ },
  { label: 'cyberdeck', re: /cyberdeck/ },
  { label: 'berserker', re: /berserker/ },
  { label: 'netrunner', re: /netrunner/ },
  // Nomes de classe (RED) — caseSensitive apenas para "Solo" e "Tech", que
  // colidem com palavras comuns do PT ("O tech subiu no palco e tocou um
  // solo." passa; "O Solo articulou a gig." falha). "Fixer", "Nomad" e
  // "Medtech" não colidem com o PT — banidos em qualquer caixa e plural.
  { label: 'Solo (classe)', re: /\bSolo(?:s)?\b/, caseSensitive: true },
  // "Tech" como classe é banido; "Share Tech Mono" (fonte da marca) não.
  { label: 'Tech (classe)', re: /\bTech(?:s)?\b(?!\s+Mono)/, caseSensitive: true },
  { label: 'Fixer (classe)', re: /\bfixers?\b/ },
  { label: 'Nomad (classe)', re: /\bnomads?\b/ },
  { label: 'Medtech (classe)', re: /\bmedtechs?\b/ },
  // Extensão terminológica #2 (issue #136): gig/crew e nomes de atividades.
  // "bonde", "trampo", "rinha" e "racha" NUNCA são banidos (palavras comuns
  // do PT). O guard cobre apenas o texto de produto; linhas com citação de
  // código/API marcadas "#145" são puladas (rename de schema é follow-up).
  { label: 'gig', re: /\bgigs?\b/ },
  { label: 'crew', re: /\bcrews?\b/ },
  { label: 'Fight Pit', re: /\bfight\s*pits?\b/i },
  { label: 'Drone Races', re: /\bdrone\s*races?\b/i },
  { label: 'Data-Trading', re: /\bdata[- ]trading\b/i },
  { label: 'Corporate Roulette', re: /\bcorporate\s*roulette\b/i },
  // Extensão terminológica #3 (issue #136): "chrome" (implantes) → "cromo".
  // "cromo" (o metal do corpo) NUNCA é banido.
  { label: 'chrome (implantes)', re: /\bchrome\b/ },
  // caseSensitive: "Underground" como nome próprio da seção §7 é banido;
  // o adjetivo minúsculo ("pirata de mídia underground") não.
  { label: 'Underground (seção)', re: /\bUnderground\b/, caseSensitive: true },
  // Extensão terminológica #4 (issue #148): lore cyberpunk residual → marca própria PT-BR.
  { label: 'flatline', re: /\bflatline\b/ },
  { label: 'stim', re: /\bstims?\b/ },
  { label: 'syn-café', re: /\bsyn[- ]?caf[eé]/ },
  { label: 'AdrenaStim', re: /\badrenastim\b/ },
  { label: 'Cortex+ (stim)', re: /\bCortex\+/, caseSensitive: true },
  { label: 'Black Lace', re: /\bblack\s*[- ]?lace\b/ },
  { label: 'Glitter (stim)', re: /\bglitter\b/ },
  { label: 'Reflex (stim)', re: /\bReflex\b(?!\s+[Tt]uner)/, caseSensitive: true },
  { label: 'Ghost (stim)', re: /\bGhost\b(?!\s+in the Shell)/, caseSensitive: true },
  { label: 'ICE', re: /\bICE\b/, caseSensitive: true },
  { label: 'Black ICE', re: /\bblack\s*ice\b/i },
  { label: 'ICEbreaker', re: /\bicebreaker\b/i },
  { label: 'Deep Net', re: /\bdeep\s*net\b/i },
  { label: 'Deep Dive', re: /\bdeep\s*dive\b/i },
  { label: 'burnout', re: /\bburnout\b/ },
  { label: 'Blackout', re: /\bblackout\b/i },
  // Extensão terminológica #5 (issue #187): nomes canônicos — implantes,
  // tiers de trampo e títulos de Moral. Lookbehind negativo poupa referências
  // a IP de terceiros ("Blade Runner") e a fase nomeada "The Legend".
  { label: 'neural booster', re: /neural\s+booster/i },
  { label: 'reflex tuner', re: /reflex\s+tuner/i },
  { label: 'subdermal armor', re: /subdermal\s+armor/i },
  { label: 'street level', re: /street\s+level/i },
  { label: 'Runner (título)', re: /(?<!Blade\s+)\bRunner\b/, caseSensitive: true },
  { label: 'Legend (título)', re: /(?<!The\s+)\bLegend\b/, caseSensitive: true },
  { label: 'Unknown (título)', re: /\bUnknown\b/, caseSensitive: true },
  { label: 'loot', re: /loot/i },
  { label: 'access chip', re: /access[- ]?chip/i },
]

// Self-check de eficácia (#148): cada entrada do BANNED tem um probe sintético
// que DEVE disparar o regex. Se o probe não casar, a entrada está morta (ex:
// regex case-sensitive testado contra linha lowercased) e o guard falha na
// largada em vez de deixar o termo passar em silêncio. Uma probe por entrada
// (cobertura total, incluindo as pré-existentes do #147).
const PROBES = {
  'sandevistan': 'Ele ativou o sandevistan.',
  'gorilla arms': 'Gorilla Arms de titânio.',
  'mantis blades': 'Mantis Blades cromadas.',
  'kiroshi': 'Óptica Kiroshi instalada.',
  'maxtac': 'A MaxTac chegou ao local.',
  'trauma team': 'Trauma Team em rota.',
  'blackwall': 'Além da Blackwall.',
  'braindance': 'Gravar um braindance.',
  'choom': 'Ei, choom, se liga.',
  'edgerunner': 'Um edgerunner de elite.',
  'night city': 'Bem-vindo a Night City.',
  'night city legend': 'Virar uma Night City Legend.',
  'silverhand': 'O Silverhand apareceu.',
  'afterlife': 'O clube Afterlife.',
  'johnny silverhand': 'Johnny Silverhand no palco.',
  'monowire': 'Chicote monowire.',
  'berserk': 'Modo berserk ativado.',
  'street cred': 'Ganhou street cred.',
  'ripperdoc': 'O ripperdoc do bairro.',
  'eddies': 'Pagou em eddies.',
  'cyberdeck': 'Seu cyberdeck novo.',
  'berserker': 'O Berserker na veia.',
  'netrunner': 'A netrunner invadiu.',
  'Solo (classe)': 'O Solo articulou a gig.',
  'Tech (classe)': 'A Tech subiu de nível.',
  'Fixer (classe)': 'O Fixer agendou o trampo.',
  'Nomad (classe)': 'Os Nomads cruzaram a fronteira.',
  'Medtech (classe)': 'A Medtech aplicou a ampola.',
  'gig': 'Aceitou a gig.',
  'crew': 'A crew se reuniu.',
  'Fight Pit': 'Desceu pro Fight Pit.',
  'Drone Races': 'Apostou nas Drone Races.',
  'Data-Trading': 'Mercado de Data Trading.',
  'Corporate Roulette': 'Jogou Corporate Roulette.',
  'chrome (implantes)': 'Implante de chrome.',
  'Underground (seção)': 'A seção Underground do mercado.',
  'flatline': 'Sofreu um flatline.',
  'stim': 'stim barato na esquina.',
  'syn-café': 'syn-café na esquina.',
  'AdrenaStim': 'AdrenaStim na veia.',
  'Cortex+ (stim)': 'Usou Cortex+ e ficou ligado.',
  'Black Lace': 'Vendeu Black Lace.',
  'Glitter (stim)': 'Glitter no sangue.',
  'Reflex (stim)': 'Reflex na veia.',
  'Ghost (stim)': 'Ghost na veia.',
  'ICE': 'ICE camada 3.',
  'Black ICE': 'Programa Black ICE.',
  'ICEbreaker': 'Rodou o ICEbreaker.',
  'Deep Net': 'Mergulhou na Deep Net.',
  'Deep Dive': 'Um Deep Dive arriscado.',
  'burnout': 'Ressaca de burnout.',
  'Blackout': 'Durante o Blackout.',
  'neural booster': 'Neural Booster na promoção do ferrageiro.',
  'reflex tuner': 'Reflex Tuner instalado.',
  'subdermal armor': 'Subdermal Armor de titânio.',
  'street level': 'Trampo street level no beco.',
  'Runner (título)': 'O Runner cruzou a rua.',
  'Legend (título)': 'O Legend da quebrada.',
  'Unknown (título)': 'Um Unknown apareceu no beco.',
  'loot': 'Distribuição de loot por tier.',
  'access chip': 'Vendeu um access-chip na esquina.',
}

// Roda o self-check antes da varredura. Em falha, lista as labels que não
// dispararam e aborta (exit 1); senão imprime a contagem e segue.
function selfCheck() {
  const dead = []
  for (const e of BANNED) {
    const probe = PROBES[e.label]
    if (probe === undefined) {
      dead.push(`${e.label} (sem probe)`)
      continue
    }
    const hit = e.re.test(e.caseSensitive ? probe : probe.toLowerCase())
    if (!hit) dead.push(e.label)
  }
  if (dead.length) {
    console.error(`✗ ${dead.length} probe(s) sem disparo: ${dead.join(', ')}`)
    process.exit(1)
  }
  console.warn(`✓ ${BANNED.length} probes ok`)
}

// ─── Varredura de código (#145) ─────────────────────────────────────────────
// Política (06-terminologia-e-ip.md): chaves internas de schema/API ficam
// (street_cred, eddies, enum lowercase solo/netrunner/etc.); só strings
// user-facing mudam. O guard cobre os termos em escopo do #145 como palavras
// isoladas; token embutido em identificador (adjacente a [A-Za-z0-9_.]) é
// interno e passa.

const CODE_ROOTS = envRoots ?? ['app/src', 'server/src', 'server/seeds', 'packages/shared/src']

// Diretórios excluídos da varredura de código (#169): migrations já aplicadas
// são histórico imutável — renomear termo em migration aplicada é anti-padrão.
// Migrações NOVAS continuam sujeitas a revisão humana no PR. Match por sufixo
// de path: exclui o diretório real no repo E um subdir homônimo em tempdir sob
// TERMINOLOGIA_ROOTS (permite teste de fixture).
const CODE_EXCLUDE = ['server/migrations']

/** Verdadeiro se `p` é um diretório listado em CODE_EXCLUDE (sufixo de path, #169). */
function isExcludedDir(p) {
  return CODE_EXCLUDE.some((ex) => p.endsWith(`/${ex}`) || p === ex)
}

// Extensões varridas no código (.mts/.cts incluídos caso venham a existir).
const CODE_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.js', '.sql']

// Termos em escopo do #145. Mesmo contrato do BANNED: caseSensitive testa a
// linha original (nomes de classe que colidem com palavras comuns do PT);
// padrão case-insensitive testa a linha lowercased.
const CODE_BANNED = [
  { label: 'street cred', re: /street\s+cred/i },
  // Exceção aplicada na varredura: campo/declaração `eddies: …` e enum string
  // "eddies" são tokens de API (ver CODE_ALLOWED).
  { label: 'eddies', re: /eddies/i },
  // Exceção aplicada na varredura: `RIPPERDOC` ALLCAPS é o enum value interno.
  { label: 'ripperdoc', re: /ripperdoc/i },
  { label: 'edgerunner', re: /edgerunner/i },
  // Nomes de classe (RED): maiúsculo é user-facing; minúsculo é enum interno.
  { label: 'Netrunner (classe)', re: /\bNetrunner\b/, caseSensitive: true },
  { label: 'Fixer (classe)', re: /\bFixer\b/, caseSensitive: true },
  { label: 'Solo (classe)', re: /\bSolo\b/, caseSensitive: true },
  { label: 'Tech (classe)', re: /\bTech\b(?!\s+Mono)/, caseSensitive: true },
  { label: 'Nomad (classe)', re: /\bNomad\b/, caseSensitive: true },
  { label: 'Medtech (classe)', re: /\bmedtech\b/i },
  { label: 'choom', re: /choom/i },
  // Extensão #180: termos canônicos já limpos nos cards #165-#167/#179 entram
  // na varredura de código. Sem \b no regex — a regra word-boundary do código
  // (isEmbeddedToken) já isola identificadores embutidos (gigId, useGigStore,
  // chromePower); palavras isoladas caem na varredura (user-facing vs token
  // interno é resolvido por CODE_ALLOWED pontual).
  { label: 'gig', re: /gigs?/i },
  { label: 'chrome (implantes)', re: /chrome/i },
  { label: 'stim', re: /stims?/i },
  { label: 'kiroshi', re: /kiroshi/i },
  { label: 'syn-café', re: /syn[- ]?caf[eé]/i },
  { label: 'gorilla arms', re: /gorilla arms/i },
  // Extensão #187: nomes canônicos — implantes, tiers e títulos de Moral.
  // Sem \b no regex — a regra word-boundary (isEmbeddedToken) isola
  // identificadores embutidos (LegendRepository, buildLegendInserts); tokens
  // internos legítimos como palavras isoladas são resolvidos por CODE_ALLOWED.
  { label: 'neural booster', re: /neural\s+booster/i },
  { label: 'reflex tuner', re: /reflex\s+tuner/i },
  { label: 'subdermal armor', re: /subdermal\s+armor/i },
  { label: 'street level', re: /street\s+level/i },
  { label: 'runner', re: /runner/i },
  { label: 'legend', re: /legend/i },
  { label: 'unknown (Moral)', re: /"Unknown"|'Unknown'/i },
  // Extensão #189: "MaxTac" (força de elite) → "A Garra". Sem \b — a regra
  // word-boundary (isEmbeddedToken) isola identificadores embutidos.
  { label: 'maxtac', re: /maxtac/i },
]

// Self-check do CODE_BANNED (mesmo padrão do PROBES): cada probe deve disparar
// o regex da entrada. Probe morto = guard cego = aborta na largada.
const CODE_PROBES = {
  'street cred': 'Ganhou street cred na rua.',
  'eddies': 'Pagou 50 eddies na hora.',
  'ripperdoc': 'O ripperdoc do bairro.',
  'edgerunner': 'Um edgerunner de elite.',
  'Netrunner (classe)': 'A Netrunner invadiu o sistema.',
  'Fixer (classe)': 'O Fixer agendou o trampo.',
  'Solo (classe)': 'O Solo articulou a emboscada.',
  'Tech (classe)': 'A Tech subiu de nível.',
  'Nomad (classe)': 'A Nomad cruzou a fronteira.',
  'Medtech (classe)': 'A medtech aplicou a ampola.',
  'choom': 'Ei, choom, se liga.',
  'gig': 'Aceitou a gig.',
  'chrome (implantes)': 'Implante de chrome.',
  'stim': 'stim barato na esquina.',
  'kiroshi': 'Óptica Kiroshi instalada.',
  'syn-café': 'syn-café na esquina.',
  'gorilla arms': 'Gorilla Arms de titânio.',
  'neural booster': 'Implantou um neural booster.',
  'reflex tuner': 'Implantou um reflex tuner.',
  'subdermal armor': 'Vestiu subdermal armor.',
  'street level': 'Trampo street level.',
  'runner': 'Um runner qualquer.',
  'legend': 'Um legend da quebrada.',
  'unknown (Moral)': 'Título "Unknown" é proibido.',
  'maxtac': 'A MaxTac chegou ao local.',
}

// Allowlist pontual de tokens internos legítimos como palavras isoladas.
// Cada entrada tem `on` (label do CODE_BANNED que ela exime — regras
// label-scoped, sem vazamento entre termos) e um regex ancorado a formas
// precisas de token (aspas/slash/dois-pontos/hífen nos DOIS lados, ou chave
// de propriedade seguida de `:`) — prosa user-facing como "pagou 50 eddies"
// ou "aceitou a gig" nunca casa. Entradas com `match` testam só o trecho
// casado (linha original, caixa preservada).
const CODE_ALLOWED = [
  // Chave/declaração de campo `eddies` (API field): `eddies: number` em
  // packages/shared, `eddies: Number(...)` em admin-service.
  { label: 'campo eddies (declaração)', re: /\beddies\??\s*:/i, on: 'eddies' },
  // Enum string e item id internos entre aspas: type: "eddies",
  // itemId: "eddies", itemType: "EDDIES", toHaveProperty("eddies").
  { label: 'enum string "eddies"', re: /["'`]eddies["'`]/i, on: 'eddies' },
  // Valor ALLCAPS do enum vendor_type (interno). Entrada por TOKEN (match+on):
  // o regex roda sobre o trecho casado na linha ORIGINAL (caixa preservada) —
  // "RIPPERDOC" passa; "Ripperdoc"/"ripperdoc" user-facing continuam falhando.
  { label: 'enum vendor_type RIPPERDOC (ALLCAPS)', match: /^RIPPERDOC$/, on: 'ripperdoc' },
  // ── Extensão #180: tokens internos dos termos novos ─────────────────────
  // Token ancorado dos DOIS lados por aspas/backtick/slash/hífen/dois-pontos:
  // rota "/api/gigs" (em comentário, escrever `GET /api/gigs` entre
  // backticks), enum "gig", import game/gigs, arquivo gig-service, itemId
  // "combat-stim", chave Redis nil:stim:. Prosa user-facing ("aceitou a gig",
  // 'implante de chrome', 'stim barato') tem espaço em pelo menos um dos
  // lados e nunca casa.
  { label: 'token gig(s) em rota/enum/import/tabela', re: /["'`/]gigs?(["'`/]|-)/i, on: 'gig' },
  // Declaração de campo/propriedade do API shape: gigs: [], gig: GigListItem.
  { label: 'campo gig(s) (declaração)', re: /\bgigs?\??\s*:/i, on: 'gig' },
  // Nome de tabela em SQL de teste (schema legado #145): TRUNCATE TABLE gigs.
  { label: 'tabela gigs em SQL (TRUNCATE/FROM/JOIN)', re: /\b(?:TABLE|FROM|JOIN|INTO|UPDATE)\s+gigs?\b/i, on: 'gig' },
  // Rotas/imports de implantes: "/api/chrome", "./chrome-service", "CHROME".
  // `?` cobre query string de URL em teste (`/api/chrome?tier=1`).
  { label: 'token chrome em rota/enum/import', re: /["'`/]chromes?(["'`/?]|-)/i, on: 'chrome (implantes)' },
  // Declaração de campo: chrome: 5, chrome: ChromeRepository.
  { label: 'campo chrome (declaração)', re: /\bchromes?\??\s*:/i, on: 'chrome (implantes)' },
  // itemId/slug interno do implante ocular (user-facing: Óptica Vidraça).
  // Ancorado nos DOIS lados (aspas/backtick/slash): o token é sempre citado
  // ("kiroshi-optics"); prosa como "kiroshi optics na promoção" não exime.
  { label: 'itemId kiroshi-optics (token interno)', re: /["'`/]kiroshi[- ]?optics["'`/]/i, on: 'kiroshi' },
  // Rotas/itemId/chaves de ampolas: "combat-stim", Redis nil:stim:.
  { label: 'token stim em rota/itemId/chave Redis', re: /["'`/:-]stims?["'`/:-]/i, on: 'stim' },
  // itemId interno do consumível de NIL (user-facing: Pingado).
  { label: 'itemId syn-cafe (token interno)', re: /["'`/]syn[- ]?caf[eé]["'`]/i, on: 'syn-café' },
  // ── Extensão #187: tokens internos dos termos novos ─────────────────────
  // Campo de API `legend` (declaração de tipo do shape de resposta):
  // legend: { ... } em packages/shared. Chave interna — user-facing é "Lenda".
  { label: 'campo legend (declaração)', re: /\blegends?\??\s*:/i, on: 'legend' },
  // Import do módulo legend-repository: token ancorado por slash antes e
  // hífen depois ("/legend-") — prosa user-facing ("a Legend") não casa.
  { label: 'import legend-repository (token interno)', re: /["'`/]legends?-/i, on: 'legend' },
  // Fallback interno "unknown" (telemetria/auditoria) — lowercase apenas
  // (regex sem /i): o título user-facing "Unknown" (capital) segue banido.
  { label: 'fallback "unknown" (token interno)', re: /["'`]unknown["'`]/, on: 'unknown (Moral)' },
]

/** Caracteres considerados parte de identificador/token interno. */
const IDENT_CHAR = /[A-Za-z0-9_.]/

/**
 * Regra word-boundary (#145): o match só é violação quando é palavra isolada
 * (delimitada por não-identificadores). Adjacente a letra/dígito/underscore/
 * ponto = embutido em identificador maior = token interno = permitido.
 */
function isEmbeddedToken(line, index, length) {
  const before = index > 0 ? line[index - 1] : ''
  const after = index + length < line.length ? line[index + length] : ''
  return (before !== '' && IDENT_CHAR.test(before)) || (after !== '' && IDENT_CHAR.test(after))
}

function selfCheckCode() {
  const dead = []
  for (const e of CODE_BANNED) {
    const probe = CODE_PROBES[e.label]
    if (probe === undefined) {
      dead.push(`${e.label} (sem probe)`)
      continue
    }
    const hit = e.re.test(e.caseSensitive ? probe : probe.toLowerCase())
    if (!hit) dead.push(e.label)
  }
  if (dead.length) {
    console.error(`✗ ${dead.length} probe(s) de código sem disparo: ${dead.join(', ')}`)
    process.exit(1)
  }
  console.warn(`✓ ${CODE_BANNED.length} code probes ok`)
}

function walkCode(dir) {
  const files = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return files
  }
  for (const entry of entries) {
    const p = join(dir, entry)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      const base = entry.toLowerCase()
      if (base === 'node_modules' || base === 'dist' || base === 'build') continue
      if (isExcludedDir(p)) continue
      files.push(...walkCode(p))
    } else if (CODE_EXTS.some((ext) => p.endsWith(ext))) {
      files.push(p)
    }
  }
  return files
}

/** Varredura de código: imprime `file:line:label` e devolve a contagem. */
function checkCode() {
  let violations = 0
  for (const root of CODE_ROOTS) {
    for (const file of walkCode(root)) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        // Escape de última instância: linha marcada #145 com comentário
        // auditável na própria linha (não usar sem justificativa).
        if (/#145/.test(line)) return
        for (const e of CODE_BANNED) {
          const src = e.caseSensitive ? line : line.toLowerCase()
          // Multi-match (#180): uma ocorrência embutida no início da linha
          // não pode mascarar uma ocorrência solta mais adiante (ex:
          // calculateChromePower + "chrome" em prosa na mesma linha). Regex
          // fresh com /g por linha — os do CODE_BANNED não têm /g para não
          // vazar lastIndex entre execuções.
          const re = new RegExp(e.re.source, e.re.flags.includes('g') ? e.re.flags : `${e.re.flags}g`)
          for (const m of src.matchAll(re)) {
            if (isEmbeddedToken(src, m.index, m[0].length)) continue
            // Allowlist: label-scoped (`on`) — regra de linha (re) ou de token
            // casado (match). O token é lido na linha ORIGINAL — o src
            // case-insensitive é lowercaseado e esconderia a caixa alta
            // (ex: enum RIPPERDOC).
            const allowed = CODE_ALLOWED.some((a) => {
              if (a.on && a.on !== e.label) return false
              return a.match
                ? a.match.test(line.slice(m.index, m.index + m[0].length))
                : a.re.test(line)
            })
            if (allowed) continue
            console.log(`${file}:${i + 1}:${e.label}`)
            violations++
            break
          }
        }
      })
    }
  }
  return violations
}

const CANONICAL = 'docs/definicoes-de-produto/06-terminologia-e-ip.md'
const PIPELINE_DOC = 'docs/design/04-pipeline-ia-e-prompts.md'
// Negação nominativa: "SP não é Night City" (ou "não Night City nem Neo
// Tokyo"). Cobre "não é"/"nao e" e o "não" elíptico do README de design.
const NEGATION = /\bnão\b|\bnao\b/i

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) files.push(...walk(p))
    else if (p.endsWith('.md')) files.push(p)
  }
  return files
}

// "Night City" sozinho (sem "legend") é permitido somente em negação
// nominativa ("não é Night City"). "night city legend" é banido sempre —
// a exceção nunca o cobre (só o termo "night city" puro é eximido).

selfCheck()
selfCheckCode()

let violations = 0
const files = [...ROOTS.flatMap(walk), ...FILES]
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  let inCodeFence = false
  // Frontmatter YAML (--- ... ---): description em inglês é regra do harness,
  // não texto de produto. Pula até o fechamento do bloco.
  let inFrontmatter = lines[0].trim() === '---'
  lines.forEach((line, i) => {
    if (file === CANONICAL) return // inventário canônico
    const trimmed = line.trim()
    if (inFrontmatter) {
      if (i > 0 && trimmed === '---') inFrontmatter = false
      return
    }
    // Blocos de código (SQL, TS...) são código interno — rename de schema
    // e tokens é #145; o guard cobre apenas texto de produto.
    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence
      return
    }
    if (inCodeFence) return
    if (file === PIPELINE_DOC && /não usar|nao usar/i.test(line)) return // linha que documenta a lista proibida
    if (/#145/.test(line)) return // citação de código/API marcada — rename de schema/labels é a follow-up #145
    const lower = line.toLowerCase()
    const hits = BANNED.filter((e) => e.re.test(e.caseSensitive ? line : lower))
      .filter((e) => !(e.label === 'night city' && NEGATION.test(line)))
    // dedupe: "silverhand" ⊂ "johnny silverhand" → reporta só o mais específico
    const matched = hits.filter((e) => !hits.some((o) => o !== e && o.label.includes(e.label)))
    for (const e of matched) {
      console.log(`${file}:${i + 1}:${e.label}`)
      violations++
    }
  })
  // Fence aberta = varredura incompleta do arquivo. Avisa mas não falha:
  // cabe a quem editar o doc fechar o bloco (o conteúdo interno é #145).
  if (inCodeFence) console.log(`⚠ fence não fechada em ${file}`)
}

// Varredura de código (#145) — roda por último; as violações somam no total.
violations += checkCode()

process.exit(violations ? 1 : 0)
