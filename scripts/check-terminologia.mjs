#!/usr/bin/env node
/* global console, process */
// Guard de consistência terminológica (issue #136, extensão de contexto PR #147).
// Falha (exit 1) se termos banidos de IP de terceiros reaparecerem nos docs.
// Zero dependências: node scripts/check-terminologia.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = [
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
const FILES = ['README.md', 'docs/BETA_CHECKLIST.md']

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

process.exit(violations ? 1 : 0)
