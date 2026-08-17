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
]

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

let violations = 0
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    let inCodeFence = false
    lines.forEach((line, i) => {
      if (file === CANONICAL) return // inventário canônico
      // Blocos de código (SQL, TS...) são código interno — rename de schema
      // e tokens é #145; o guard cobre apenas texto de produto.
      const trimmed = line.trim()
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
}

process.exit(violations ? 1 : 0)
