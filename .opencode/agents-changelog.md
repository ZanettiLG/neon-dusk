# Agents Changelog — Neon Dusk

Histórico de mudanças nos agentes de desenvolvimento.

## 2026-08-29
### Trigger
Decisão humana: aplicar mapping otimizado de modelos (pesquisa deep-researcher, cenário −42.5% de consumo).

### Change
- decision-agent: glm-5.3 → glm-5.3-flash (9× mais barato, GDPval-AA v2 Elo 1773 > 1769) + descrição stale "Claude Opus 4.8" corrigida
- architect, db-designer, dev-orchestrator, game-logic-dev: deepseek-v4-pro → deepseek-v4-flash
- Manter em v4-pro: code-reviewer, pr-reviewer (#1 CodeReviewBench F1 43.9), harness-engineer
- Manter: developer/test-writer/github-ops/deep-researcher (flash), qa-browser (flash-vision-exp)

### Impact
Redução estimada de 42.5% na taxa de consumo do orçamento de uso ($12/5h, $60/mês) — dobra o headroom do pipeline. Risco: degradação de gates evitada (pro mantido); nota: model changes só valem após restart da sessão opencode.

---

## 2026-08-29
### Trigger
Otimização de custo dos agentes (decisão humana: commit parcial do stash de modelos).

### Change
qa-browser: opencode-go/deepseek-v4-pro → opencode-go/deepseek-v4-flash-vision-exp (capacidade de visão para análise de screenshots). code-reviewer e pr-reviewer PERMANECEM em deepseek-v4-pro (quality gates). Pesquisa de custo×benefício geral em andamento — mapping completo pendente de aprovação.

### Impact
QA interativa ganha análise visual de screenshots; revisores mantêm robustez pro. Custo de QA reduzido.

---

## 2026-08-29
### Trigger
qa-browser retornava env-blocked: MCP agent-browser não injetado na sessão do subagente (sem permissão no frontmatter) + nomes de ferramentas desatualizados no prompt.

### Change
Adicionada permissão agent_browser_* ao frontmatter; lista de ferramentas do prompt atualizada para os nomes reais do MCP (agent_browser_navigate removido).

### Impact
QA interativa executável pelo subagente qa-browser; pipeline 3.5 desbloqueado.

---

## 2026-08-20 — N1: Reuso obrigatório de componentes visuais compartilhados (feature #140)

### Trigger
Ciclo ACT→OBSERVE→REFINE da feature #140 (run_id nd-20260820-120000-trampos-teatro). O developer reimplementou `OutcomeChip` localmente em `ActiveGigPanel` em vez de reusar o `ui/OutcomeChip` exportado — violação de consistência que derrubou a nota de Manutenibilidade (5.0 → 4.0, depois corrigida no commit `a517c4c`).

### Change
- `developer` (agent): self-review 42 → 43 checks. Adicionado:
  - Componentes visuais: verifique `app/src/components/ui/` (e o index de exports) ANTES de criar qualquer componente visual local — reuso obrigatório; se o compartilhado não cobre o caso (ex: prop/semântica faltando), estenda o compartilhado, nunca duplique.

### Impact
Esperado: o developer passa a consultar o catálogo de componentes compartilhados (`ui/`) antes de criar componentes locais, eliminando duplicação e a queda de nota por consistência/manutenibilidade em features futuras.

---

## 2026-08-20 — N1: Guard de terminologia no pre-handoff + curadoria contra docs canônicos (feature #137)

### Trigger
Ciclo ACT→OBSERVE→REFINE da feature #137 (Ícones P0, run_id nd-20260820-035258-icones-p0-svg). 2 padrões de falha detectados nos reviews:
1. `scripts/check-terminologia.mjs` era passo só de CI, não do checklist da feature — a branch shipou com o guard vermelho (review 1: verdict revise, min 2.5).
2. Teste de curadoria validava contra cópia local (CANONICAL) e não contra docs canônicos — oráculo autorreferencial deixou passar naming drift e termos banidos (re-review: approve_with_fixes, min 4.5).

### Change
- `developer` (agent): self-review 42 → 43 checks. Adicionado: `node scripts/check-terminologia.mjs` roda com exit 0 antes do handoff (o guard não pode ficar vermelho quando a feature shipar).
- `test-writer` (agent): self-check 10 → 11 itens. Adicionado: testes de curadoria validam contra docs canônicos (`docs/definicoes-de-produto/`), não só contra um mapa local (oráculo autorreferencial).

### Impact
Esperado: o guard de terminologia deixa de ser surpresa pós-handoff (vermelho só no CI) e passa a rodar dentro do ciclo do developer; testes de curadoria deixam de ter oráculo autorreferencial e passam a cross-check com a fonte canônica — eliminando naming drift e termos banidos que escapavam da validação local.

---

## 2026-08-19 — N1: Fixtures canônicas + grep global de strings user-facing (cards #165/#167)

### Trigger
Ciclo ACT→OBSERVE→REFINE dos cards de terminologia #165 (run_id nd-20260819-063300-runner-corredor) e #167 (run_id nd-20260819-063400-gig-trampo). 2 padrões de falha detectados nos ciclos de review:
1. **#165**: developer mutou a fixture de teste ("Corredor"→"Legend") para evitar colisão de `getByText`, em vez de escopar a query — reviewer pegou (score 4.2 → fix).
2. **#167**: string user-facing escapou ("Cooldown de Gigs" em `admin/ParamsTab`) porque o grep foi focado nos arquivos tocados — reviewer pegou (W-1).

### Change
- `developer` (agent): self-review 40 → 42 checks. Adicionados:
  - Fixtures de teste permanecem consistentes com dados canônicos (ladder, enums); colisão de texto no DOM se resolve escopando a QUERY (getByRole/within), nunca mutando o dado da fixture
  - Ao trocar uma string user-facing, grepei o termo em TODO o código (inclusive admin views e testes) — nenhuma ocorrência escapou

### Impact
Esperado: fixtures de teste param de divergir dos dados canônicos (a colisão de DOM se resolve na query, não no dado) e strings user-facing deixam de escapar em views/tests fora do diff — eliminando correção fragmentada e resíduo de terminologia antiga.

---

## 2026-08-19 — N1: Mensagens user-facing em PT + padronização de error codes (feature #145)

### Trigger
Ciclo ACT→OBSERVE→REFINE da feature #145 (run_id nd-20260818-143000-terminologia-app). 2 padrões de falha detectados nos ciclos de review:
1. Mensagens user-facing traduzidas parcialmente ficaram em inglês ("Need 5 Moral, have 3", "Need G$ X available…") — 3 findings desse tipo em 6. Cada dev corrigiu só o arquivo que tocou.
2. O mesmo error code (`INSUFFICIENT_FUNDS`) tinha 3 variantes de frase no repo, porque cada correção era local ao arquivo tocado.

### Change
- `developer` (agent): self-review 38 → 40 checks. Adicionados:
  - Mensagens user-facing que toquei estão 100% em PT (sem resíduos em inglês)
  - Ao alterar uma mensagem de erro, grep pelo error code e padronize todas as variantes de uma vez

### Impact
Esperado: strings de UI saem 100% em português e um error code passa a ter uma única variante de frase no repo — eliminando a correção fragmentada por arquivo e o resíduo de inglês nas mensagens user-facing.

---

## 2026-08-18 — N2: Higiene da camada de banco (developer + code-reviewer)

### Trigger
Issue #158 documentou a degradação da camada de banco: migration consolidada de 1002 linhas (`0001_initial_schema.ts`, criada na migração Drizzle→Knex #122 e nunca mais migrações novas), lógica de seed duplicada (`seeds/01_data.ts` + `src/db/seed.ts`), scripts customizados duplicando knex nativo e 39 imports diretos de `db` — incluindo 4 rotas (health, saideira, abilities, street-cred). Causa-raiz no harness: nenhum check de higiene de migration/seed nem de layering de acesso a banco em developer.md e code-reviewer.md.

### Changes

#### developer (agent)
- Self-review: 35 → 38 checks. Adicionados:
  - Nova migration = um arquivo por entidade (uma tabela, `up` + `down`); nunca editar migration já aplicada
  - Seeds idempotentes (upsert/onConflict — nunca `del()` + insert) e sem duplicar lógica de seed existente
  - Rotas não importam `db` diretamente — queries do banco vivem em services

#### code-reviewer (agent)
- Critério 5 (Consistência) ganhou 3 sub-checks:
  - **DB layering**: `db` direto em rotas é violação (services podem usar `db` até existir repository layer)
  - **Migration hygiene**: schema novo por edição de migration já aplicada é violação
  - **Seed duplication**: entidade semeada em 2+ lugares ou seed destrutivo é violação

### Impact
Esperado: features futuras criam migrations por entidade, seeds idempotentes e mantêm queries em services — interrompendo a consolidação incremental de `0001_initial_schema.ts` e o espalhamento de imports de `db`. O código legado degradado fica para o refactor da issue #158 (não tratado pelo harness).

---

## 2026-08-18 — N1: Validação client-side espelhando schema do servidor (feature #138)

### Trigger
Ciclo ACT→OBSERVE→REFINE da feature #138 (Auth + criação de personagem, run_id nd-20260818-141500-auth-character). Score 4.5/5.0 (APPROVED_WITH_FIXES). Único finding: validação client-side que afirma espelhar o schema do servidor, mas usa regex mais permissiva que a do zod (`EMAIL_RE` aceita `a@b.c`, `z.email()` rejeita) — o erro só aparece no round-trip, o oposto do objetivo de erros inline. Causa raiz: o developer implementou a validação do cliente por aproximação, sem ler o schema exato do servidor.

### Change
- `developer` (agent): novo check no self-review — "Validação client-side de campos espelhados do servidor: copie a regra EXATA do schema do servidor (mesma regex/zod); nunca valide por aproximação — leia o schema do servidor antes de escrever o regex do cliente". Total de checks: 34 → 35.

### Impact
Esperado: eliminar divergência entre validação client-side e schema do servidor; erros de validação voltam a aparecer inline (antes do round-trip), alinhado ao objetivo de UX.

---

## 2026-08-17 — N1: Lint no self-review do developer + contagem real de testes no test-writer (feature #134)

### Trigger
Ciclo ACT→OBSERVE→REFINE da feature #134 (Biblioteca de componentes base, run_id nd-20260817-220100-component-library). Score 4.5/5.0 (gate atingido, 2 ciclos de correção). Padrões observados:
1. Developer não rodou `npm run lint` — o import morto em teste só foi detectado pelo code-reviewer, custando 1 ciclo extra.
2. Contagens de testes inconsistentes — developer e test-writer reportaram "55 testes" quando o runner executou 63.

### Changes

#### developer (agent)
- Self-review: novo check "`npm run lint` (raiz) passa com zero erros/warnings antes do handoff (imports mortos, variáveis não usadas, etc.)". Total de checks: 33 → 34.

#### test-writer (agent)
- Regra adicionada: "Reporte no handoff a contagem real de testes obtida do runner (total executado pela suite), nunca uma estimativa".

#### qa-browser (agent) — observação, sem mudança
- 2 cancelamentos/abortos na feature #134 (tarefas longas de browser). Sem evidência de defeito de design do agente; provável ruído de ambiente. Nenhuma alteração aplicada; monitorar nas próximas features.

### Impact
Esperado: eliminar o ciclo extra de lint (check passa a viver no self-review, não depende do reviewer); padronizar contagens de teste reportadas nos handoffs.

---

## 2026-08-09 — N2: Migração Drizzle ORM → Knex.js (Skills + Agents)

### Trigger
Migração da stack ORM: Drizzle ORM substituído por Knex.js. Knex oferece query builder nativo, schema builder para migrations e melhor controle sobre raw SQL — mais alinhado com as necessidades do Neon Dusk (triggers, views, funções PostgreSQL nativas).

### Changes

#### sql-design (skill)
- **Seção "Migrations (Drizzle)"** substituída por **"Migrations (Knex)"** com:
  - Padrão `export function up(knex)` / `export function down(knex)`
  - Schema builder: `createTable`, `table.uuid`, `table.specificType`, `table.jsonb`, `table.enu`
  - Raw SQL para enums nativos (`CREATE TYPE ... AS ENUM`)
  - Padrão de seed com `export async function seed(knex)`
  - Tabela de referência com métodos do schema builder

#### nodejs-patterns (skill)
- **Seção "Database Access (Drizzle)"** substituída por **"Database Access (Knex)"** com:
  - Connection setup (`knex({ client: 'pg', pool: {...} })`)
  - Query builder: `select`, `insert`, `update`, `join`, `.returning()`
  - Transaction pattern com `.transacting(trx)` e `forUpdate()`
  - Raw queries via `db.raw()`
  - Tabela de stack: `ORM: Drizzle` → `Query Builder: Knex.js`
  - Anti-padrão: `Drizzle with` → `Knex eager-loading`

#### developer (agent)
- Self-review check #2: `Knex/Drizzle` → `Knex`
- Stack: `ORM: Drizzle` → `Query Builder: Knex.js`

#### testing-patterns (skill)
- Sem alterações — skill não referenciava Drizzle

#### architect (agent)
- Sem alterações — agente não referenciava Drizzle

### Impact
Harness alinhado com Knex.js. Agentes agora produzem migrations com `exports.up`/`exports.down`, queries com query builder tipado e transações com `.transacting()`. Sem impacto em skills agnósticas (game-economy, cyberpunk-lore, react-patterns, etc.).

---

## 2026-08-08 — N3: Pipeline GitHub-Native Default + Capability Gate + Commit Step

### Trigger
Pipeline workflow com problemas estruturais: GitHub era opt-in (`--github`), zero rastreabilidade, sem capability check antes de spawnar agentes, sem step de commit entre implementação e review.

### Changes

#### dev-orchestrator (refatoração N3)
- **Flag invertida**: `--github` → `--local` (GitHub é o default)
- **Passo -1: Capability Gate**: Pre-flight check de skills, agentes e `gh auth status`. Mapeamento feature→skills para detecção automática de gaps. Spawna `harness-engineer` se capacidade ausente.
- **Passo 0: GitHub Setup**: Default (pular com `--local`). Inclui `gh auth status`. Contexto (`issue_number`, `branch`) propagado para subagentes.
- **Passo 2.5: Commit**: Novo step pós-implementação. Conventional commits (`closes #<issue>`). Branch enforcement.
- **Handoffs**: GitHub-native por padrão. `--local` usa handoffs inline.
- **Anti-padrões**: Atualizados para refletir default GitHub-native.
- **Skills**: `github-workflow` carregada sempre (não condicional).

#### github-ops (atualizado)
- Nova operação `check-auth`: verifica `gh auth status` como pre-flight.
- Commit segue `closes #<issue>` / `fixes #<issue>`.

#### qa-browser (atualizado)
- Referência defasada a `--github` removida da seção "Integração com GitHub".

### Impact
Pipeline 100% rastreável por padrão. Toda feature tem issue, branch, commits e PR. Agentes só executam tasks para as quais têm capacidades verificadas. Zero alterações anônimas no git.

---

## 2026-08-08 — N1: Data Display View Patterns (Issue #69 Post-Mortem)

### Trigger
Issue #69 (5 nav links + 7 new views) went through 3 review cycles but stagnated at score 4.0 — each cycle found new small issues instead of fixes improving the score. Root cause analysis:

1. **Repetitive view boilerplate**: 5+ views follow identical fetch→loading→error→data pattern, but react-patterns skill had no positive template — only an anti-pattern note.
2. **Style drift**: `.then()` vs `async/await` mixing crept in and was only caught at review, not by developer self-check.
3. **Missing cleanup**: `cancelled`/`mountedRef` pattern was added in cycle 3 — should have been caught by developer before cycle 1.
4. **Tab component duplication**: ChromeView and PvpView independently defined identical Tab components — caught only in review cycle 2.
5. **Score stagnation**: 3 cycles at 4.0 — reviewer kept finding new small issues because developer had no preventive checks.

### Changes

#### developer
- Self-review expanded from 30→33 checks:
  - #31: Consistent async style — no `.then()` / `async/await` mixing in same file
  - #32: Async cleanup on every useEffect with fetch — `cancelled`/`abortRef` pattern
  - #33: No duplicated UI components — extract to `shared/` if used in 2+ views

#### react-patterns (skill)
- New section "Data Display View Template": standard pattern for CRUD list views with 4 distinct states (loading→error→empty→data), `cancelled` cleanup, `async/await`, `api` client
- Anti-pattern updated: `useEffect` para fetch → points to template with `cancelled` flag
- Template enforces: always `async/await`, never `.then()` in views

#### code-reviewer
- Critério #5 (Consistência) expanded with 2 sub-checks:
  - **Duplicate UI components**: scan new pages for repeated component structures (Tab, card grid, filter bar, modal wrapper) — flag for extraction to `shared/`
  - **Async style drift**: `.then()` / `async/await` mixing within same file or across sibling files

### Impact
Prevents recurrence of: repetitive view boilerplate without cleanup (cycle 1), async style inconsistency (cycle 2 detection window), component duplication caught only mid-review (cycle 2), and score stagnation from late discoveries. N1 checks are cheap — grep for `.then(` in new files, scan for repeated JSX shapes, verify `cancelled` flag in every `useEffect` with async.

---
### Trigger
ND-018 code review found 3 critical issues: E2E dirty state on failure, missing admin acceptance in smoke test, silent version conflicts in economy check.

### Change
Added 3 items to developer self-review checklist (smoke coverage, optimistic locking, E2E cleanup). Added 1 item to code-reviewer checklist (admin route bidirectional testing).

### Impact
Expected to prevent these pattern failures in future features.

---

## 2026-08-07 — N1: Admin Panel Post-Mortem — LIKE Escaping + Redis Batch Checks (ND-052)

### Trigger
Feature ND-052 (Admin Panel) went through 3 review cycles but couldn't reach score 4.5:
1. **Cycle 1 (3.5)**: LIKE injection in search (`escapeLike` missing), N+1 Redis calls, seed case-sensitivity
2. **Cycle 2 (4.0)**: All fixes applied — core solid at 5.0 in 5 criteria, test coverage at 4.0
3. **Cycle 3 (4.0)**: 6 new tests added — but a residual bug found: `escapeLike` doesn't escape backslash before `%` and `_`

Root cause: code-reviewer had no explicit sub-check for LIKE/ILIKE escaping or Redis N+1 patterns. Developer and reviewer both have blind spots.

### Changes

#### code-reviewer
- Critério #2 (Segurança) expanded with sub-check:
  - **LIKE/ILIKE escaping**: verify `%`, `_`, and `\` are escaped before interpolation into LIKE patterns. Backslash must be escaped FIRST (`\\` → `\\\\`) before `%`/`_` to prevent residual escape sequences.
- Critério #3 (Performance) expanded with sub-check:
  - **Redis batch operations**: `.map()` or loop with individual Redis calls is an anti-pattern — suggest `mget`/`mset`/`pipeline`. Threshold: > 2 sequential single-key Redis calls in same codepath = violation.

### Impact
Prevents recurrence of: LIKE wildcard injection in search/filter endpoints (security) and N+1 Redis calls degrading performance under high concurrency. Both sub-checks are low-cost to verify — grep for `.ilike(` / `.like(` in query builders and `redis.get(` inside `.map()` in services.

---
## 2026-08-07 — N2: QA Browser integrado como passo default no pipeline

### Trigger
QA suite (#49-#62) executada em 14 áreas do Neon Dusk descobriu 21 bugs — mas o bug mais óbvio (ActiveGigPanel não renderiza fase "execute") escapou porque o qa-browser nunca foi spawnado. O agente existia mas era opcional (`--qa`), e ninguém passava a flag.

### Changes
- **dev-orchestrator.md**: QA browser movido de opcional (`--qa`) para default (pular com `--skip-qa`)
- **dev-orchestrator.md**: Anti-padrão atualizado — pular QA sem `--skip-qa` explícito agora é erro
- **dev-orchestrator.md**: Passo 3.5 atualizado com instrução explícita: "NÃO apenas tira snapshots — navega clicando botão por botão"
- **dev-feature.md**: Pipeline atualizado para incluir qa-browser como passo padrão
- **dev-feature.md**: Flag `--skip-qa` adicionada para features urgentes

### Rationale
O QA browser é a única camada que verifica a jornada interativa completa do usuário. Testes automatizados (test-writer) cobrem lógica e API, mas não detectam fases de UI não renderizadas, transições quebradas entre estados, ou falta de feedback visual. QA deve ser default — pular é a exceção.

## 2026-08-07 — N3: QA Browser Agent (E2E Testing)

### Trigger
Necessidade de um agente de QA para testes end-to-end com browser, usando agent-browser MCP. Cobre features completas, smoke tests pós-deploy e suítes de regressão. Pipeline estruturado em 5 fases (ANALYZE → PLAN → EXECUTE → ASSERT → REPORT).

### Changes

#### qa-browser (NOVO)
- **Modelo**: deepseek-v4-pro, temperature 0.1, thinking 16K
- **Modo**: subagent, hidden
- **Permissões**: read:allow, glob:allow, grep:allow, write:allow, edit:deny, bash:deny
- **Função**: Testes E2E no browser em 3 modos: feature QA, smoke test, regression
- **Pipeline**: ANALYZE (design doc + código) → PLAN (cenários: happy/error/edge) → EXECUTE (agent-browser) → ASSERT (UI, API, console, storage) → REPORT (JSON + screenshots)
- **Skills**: neon-dusk-design, testing-patterns, github-workflow
- **Ferramentas MCP**: agent_browser_* (navigate, click, fill, snapshot, screenshot, eval, console, network, storage)

#### dev-orchestrator (atualizado)
- Novo worker: `qa-browser` — opcional com flag `--qa` (Passo 3.5 entre Test e Review)
- Flag `--qa` adicionada à lista de flags suportadas
- Anti-padrão: não usar `qa-browser` sem `--qa`

#### AGENTS.md (atualizado)
- Spawn rules: dev-orchestrator pode spawnar qa-browser; qa-browser nunca spawna qa-browser

### Impact
QA E2E automatizado via browser reduz regressões visuais e bugs de UX antes do merge. Três modos de operação: feature QA (completo), smoke test (rápido, <5min), regression suite (cross-feature). Integrado ao pipeline GitHub-native com labels `qa-failed` / `qa-passed`.

---

## 2026-08-07 — N1: Saideira Hub Harness Refinement (ND-015)

### Trigger
Feature ND-015 (Saideira Hub) implementada com score 4.5/5.0. Code-reviewer identificou 2 padrões de falha em pass 2 que não são detectáveis automaticamente por linter:

1. **SSE/hijack async setup**: `reply.raw.writeHead()` antes de `redis.duplicate()` / `subscribe()` — se Redis falha, conexão fica half-open sem cleanup
2. **Component test baseline**: ChatBox (renderizado condicionalmente dentro de tabs) não tinha teste de renderização mínimo

### Changes

#### developer
- Self-review expandido de 25→27 checks:
  - #26: SSE/hijack pattern — async setup entre `writeHead()` e `hijack()` em try/catch com cleanup (destroy socket, unsubscribe Redis)
  - #27: Component test baseline — todo componente novo que renderiza condicionalmente em view deve ter "renders without error" test (Vitest + Testing Library)

### Impact
Previne recorrência de: conexões SSE half-open em falhas de Redis (risco de resource leak) e componentes sem cobertura mínima de renderização (regressões silenciosas em refactors de view).

---

## 2026-08-07 — N1: PvP Feature Harness Refinement (ND-014)

### Trigger
Feature ND-014 (PvP System) implementada com score 4.0/5.0. Code-reviewer identificou 2 padrões de falha recorrentes que transcendem o escopo PvP:
1. **Escrow-awareness**: Serviços de débito (vendor purchases, trampo payouts, etc.) deveriam usar `balance - escrow`, mas o padrão não está documentado no self-review
2. **Telemetry dual-outcome**: Apenas `PVP_ATTACK` instrumentado; `PVP_DEFEAT` nunca emitido. Features com outcomes duais frequentemente instrumentam só o caminho feliz

### Changes

#### developer
- Self-review expandido de 23→25 checks:
  - #24: Débitos usam saldo disponível (`balance - escrow`), nunca `balance` bruto — aplica-se a PvP, vendor purchases, trampo payouts, ou qualquer operação que reserve fundos temporariamente
  - #25: Features com outcomes duais (win/loss, success/failure, accept/reject) emitem eventos de telemetria para TODOS os outcomes, não apenas o caminho feliz

### Impact
Previne recorrência de: débitos sobre saldo bloqueado (risco de saldo negativo quando escrow é liberado) e telemetria incompleta (dificulta diagnóstico de balanceamento e detecção de exploits). Checks N1 baratos — verificação de diff antes do handoff.

### N2 Proposals (pendente confirmação)
Ver `changelog.md` para propostas N2: expansão do critério de N+1 queries no code-reviewer e documentação do padrão de constantes game-logic/ vs service/.

---

## 2026-08-06 — N2: Game Mechanics Harness Refinement (ND-008 / ND-060)

### Trigger
Feature ND-008 (Lucky Chip — minigame de cassino) expôs 3 gaps no harness ao lidar com mecânicas de jogo. Ciclo 1 teve score 2/5 (code-reviewer não detectou race condition em operações de economia, teste de concorrência era no-op, RNG não determinístico nos testes). Ciclo 2 aplicou correções no código e chegou a 5/5. Aprendizados formalizados como refinamento N2 (score < 4.0 no ciclo 1).

### Changes

#### code-reviewer (atualizado)
- Critério #1 (Correção) expandido com sub-checks específicos para game economy:
  - Economy operations: optimistic locking (`WHERE balance = balanceBefore`), atomicidade entre débito/crédito, audit trail
  - Money conservation: `Σ(deltas) = 0` verificável no escopo da operação
- Critério #6 (Cobertura de Testes) expandido:
  - Concurrency test quality: `Promise.all` sozinho não verifica lock — validar que conflitos serializam (apenas 1 transação vence, demais retry/rejeitam)
  - RNG determinístico: testes devem usar seed fixa, outputs reproduzíveis

#### game-logic-dev (atualizado)
- Self-check expandido de 8→10 itens:
  - #9: Input validation — `Number.isSafeInteger`, bounds checking explícito, divisão por zero
  - #10: RNG injetável — `(rng: () => number)` como parâmetro, nunca `Math.random()` direto
- Nova seção "Templates e Padrões":
  - Template de função pura: JSDoc com `@param` bounds, `@returns` invariants, `@edgecases`
  - Padrão de RNG injetável: injeção obrigatória, seedable para teste, crypto para produção
  - Validação obrigatória de input: safe integer, bounds, divisão por zero, cap de overflow

#### testing-patterns (atualizado)
- Nova seção "Game Testing" com 4 sub-padrões:
  - RNG Seed Control: `mulberry32` seedable, outputs determinísticos, seed diferente = output diferente
  - Timer Mocking: `vi.useFakeTimers()` + `vi.advanceTimersByTime()` para NIL regen, cooldowns, durations
  - Economy Integrity: padrão `expect(Σ(payouts) − Σ(bets)).toBe(0)` para money conservation
  - Concurrency: optimistic locking com retry verificável (não só `Promise.all`); nota sobre quando NÃO usar `pg_advisory_lock`

### Impact
Previne recorrência de 3 categorias de falha que causaram score 2/5 no ciclo 1 do ND-008: race condition não detectada em operações de economia, teste de concorrência falso-positivo, e RNG não determinístico em testes. Score subiu para 5/5 no ciclo 2 após correções manuais — com o harness refinado, futuras features de jogo serão avaliadas corretamente desde o ciclo 1.

---

## 2026-08-06 — N1: CI/CD Pipeline Review Feedback (Feature ND-005)

### Trigger
Feature ND-005 (CI/CD Pipeline) passou por 3 review cycles (score: 3.0 → 4.0 → 4.5). Code-reviewer identificou 3 padrões de falha recorrentes em infraestrutura como código:

1. **Docker image ordering**: `docker compose run migrate` antes de `docker compose pull` — migrações rodam em imagem cacheada antiga (review #04, critical issue #1)
2. **workflow_run checkout footgun**: `actions/checkout@v4` sem `ref: head_sha` com trigger `workflow_run` — checkout usa default branch HEAD em vez do commit que disparou o CI (review #06, new issue)
3. **Healthcheck ausente em serviço Docker**: Design deferiu healthcheck, mas endpoint `/api/health` já existia — developer deveria ter identificado a oportunidade (review #04, warning #5)

### Changes

#### developer
- Self-review expandido de 20→23 checks:
  - #21: Docker operations ordered correctly — pull before run, up after pull (deploy scripts)
  - #22: Workflow triggers that checkout code use correct ref — `workflow_run` needs explicit `ref: ${{ github.event.workflow_run.head_sha }}`, `push`/`pull_request` use default
  - #23: Every Docker service has a healthcheck if a health endpoint exists (check `/api/health`, `/health`, or similar before writing compose)

### Impact
Previne recorrência de: migração em imagem errada (crítico), checkout de commit errado em deploy (médio), containers sem restart automático por falta de healthcheck (baixo). Checks N1 são baratos de executar — verificação manual de diff/yaml antes do handoff.

### Trigger
Post-mortem da issue #4 identificou 53% de subagent calls (8/15) como rework cycles:
1. Developer não rodava `vitest run` → regressão não detectada antes do test-writer
2. Architect não enumerava todos os error types → `isRedisError` incompleto
3. Orchestrator não detectava resposta vazia de subagent
4. Test-writer não verificava se o endpoint exercita o código-alvo

### Changes

#### developer
- Check #20 adicionado: `npx vitest run` passa com zero regressões antes do handoff

#### architect
- Check #12 adicionado: todos os tipos de erro de dependências externas (Redis, PostgreSQL, APIs) enumerados exaustivamente

#### dev-orchestrator
- Nova seção "Validação de Handoff": verifica `task_result` vazio/undefined após cada `task()`, re-executa uma vez, reporta erro no JSON se falhar novamente

#### test-writer
- Check #10 adicionado: verificar que testes exercitam o código-alvo (endpoint/rota não captura erro internamente antes do handler/middleware)

### Impact
Previne 4 categorias de rework cycle que representaram 53% de desperdício no pipeline da issue #4. Cada check N1 é barato de executar e evita 1-3 ciclos de correção.

---

## 2026-08-06 — N3: Migração Vue 3 → React 19 (Harness)

### Trigger
Issue #12 — migração do harness de desenvolvimento do ecossistema Vue para React, complementando o Epic #5 (frontend rewrite).

### Changes

#### react-patterns (NOVO, substitui vue-patterns)
- Skill renomeada: `vue-patterns` → `react-patterns`
- Stack: React 19 + Zustand 5 + React Router v7 + Tailwind CSS + vite-plugin-pwa
- Cobre: hooks, TSX, Zustand stores (devtools, persist, getState), React Router (createBrowserRouter, lazy routes, guards), Testing Library, Tailwind + React conventions

#### testing-patterns (atualizado)
- Adicionada seção "React Component Testing" com: Testing Library (render, screen, waitFor), MemoryRouter, Zustand store testing (getState/setState), Vitest + jsdom config

#### developer (atualizado)
- `vue-patterns` → `react-patterns`
- Stack: Vue 3 + Composition API → React 19 + hooks + Zustand 5
- Descrição no frontmatter atualizada

#### architect (atualizado)
- Self-check: "peer deps do Fastify, Vue" → "peer deps do Fastify, React"

#### code-reviewer (atualizado)
- `vue-patterns` → `react-patterns`

#### pr-reviewer (atualizado)
- `vue-patterns` → `react-patterns`

### Impact
Harness alinhado com a stack React definida no Epic #5. Skills framework-specific (react-patterns) substituem Vue sem afetar skills agnósticas (game-economy, cyberpunk-lore, sql-design, etc.).

---

### dev-orchestrator
- **Modelo**: deepseek-v4-pro, temperature 0.2, thinking 16K
- **Modo**: all (orquestrador principal)
- **Permissões**: edit:deny, write:deny, bash:deny
- **Função**: Coordenar pipeline de feature (6 passos). Gate de qualidade: score ≥ 4.5
- **Skills**: neon-dusk-design, continual-harness-dev

### architect
- **Modelo**: deepseek-v4-pro, temperature 0.1, thinking 32K
- **Modo**: subagent, hidden
- **Permissões**: edit:deny, bash:deny, write:allow
- **Função**: Design técnico (schema, API, arquitetura). 10 checks de self-review
- **Skills**: neon-dusk-design, nodejs-patterns, sql-design

### developer
- **Modelo**: deepseek-v4-flash, temperature 0.3, thinking 16K
- **Modo**: subagent, hidden
- **Permissões**: edit:allow, write:allow, bash:allow
- **Função**: Implementação full-stack. 25 checks de self-review
- **Skills**: neon-dusk-design, nodejs-patterns, react-patterns, sql-design

### test-writer
- **Modelo**: deepseek-v4-flash, temperature 0.1, thinking 8K
- **Modo**: subagent, hidden
- **Permissões**: edit:allow, write:allow, bash:allow
- **Função**: Testes automatizados (unit, integration, e2e, db). 8 checks de self-review
- **Skills**: testing-patterns

### code-reviewer
- **Modelo**: deepseek-v4-pro, temperature 0.1, thinking 32K
- **Modo**: subagent, hidden
- **Permissões**: edit:deny, bash:deny (read-only)
- **Função**: Revisão de qualidade (6 critérios). Ações corretivas específicas
- **Skills**: neon-dusk-design, nodejs-patterns, react-patterns, sql-design

### db-designer
- **Modelo**: deepseek-v4-pro, temperature 0.1, thinking 16K
- **Modo**: subagent, hidden
- **Permissões**: edit:deny, bash:deny, write:allow
- **Função**: Schema design PostgreSQL (migrations, índices, constraints)
- **Skills**: sql-design, game-economy

### game-logic-dev
- **Modelo**: deepseek-v4-pro, temperature 0.2, thinking 16K
- **Modo**: subagent, hidden
- **Permissões**: edit:allow, write:allow, bash:allow
- **Função**: Mecânicas de jogo (fórmulas, economia, balanceamento). 8 checks de self-review
- **Skills**: game-economy, neon-dusk-design

## 2026-08-06 — Handoff GitHub-Native + PR Reviewer

### Trigger
Handoffs em arquivos `.handoff/*.md` não escalavam. Necessidade de revisor QA/DevOps/Tech Lead para PRs.

### Changes

#### pr-reviewer (NOVO)
- **Modelo**: deepseek-v4-pro, temperature 0.1, thinking 32K
- **Modo**: subagent, hidden
- **Permissões**: bash:allow, read:allow, write:deny, edit:deny
- **Função**: Auditar PRs com 6 dimensões (código, testes, segurança, design, performance, docs). Score ≥ 4.5 aprova. Spawna github-ops para comentar no PR.
- **Skills**: neon-dusk-design, nodejs-patterns, react-patterns, sql-design, testing-patterns, github-workflow

#### github-ops (refatorado)
- Expandido com: `comment-on-issue`, `update-issue-body`, `create-sub-issue`, `update-issue-labels`, `approve-pr`, `request-changes`
- Removida dependência de arquivos `.handoff/` — GitHub é o handoff

#### dev-orchestrator (refatorado)
- Pipeline GitHub-native em 9 passos (era 8)
- Handoffs via comentários na issue, não arquivos
- Passo 8: pr-reviewer audita PR
- Passo 9: fechamento com labels de estado
- `webfetch: allow` (para ler comentários do GitHub)
- Sem `--github`: handoffs inline (JSON de resposta dos subagents)

### Impact
Dupla camada de qualidade: code-reviewer (código bruto) + pr-reviewer (PR com contexto). Zero arquivos de handoff — tudo no GitHub.

## 2026-08-06 — Integração GitHub + Correção Handoff

## 2026-08-06 — Refinamento pós Project Bootstrap

### Trigger
Pipeline Feature 0 (Project Bootstrap) executado end-to-end. Review encontrou 6 warnings + 1 design bug de versão (rate-limit v9 vs Fastify 5). Análise de padrões de falha para prevenir recorrência.

### Changes

#### developer
- Self-review expandido de 15→18 checks:
  - #16: `process.env` só em `env.ts` (validado por Zod); demais arquivos usam módulo `env`
  - #17: Frontend usa `api` client (`@/api/client`), nunca `fetch` raw
  - #18: Tipos de API response em `packages/shared/`, não duplicados

#### test-writer
- Self-check expandido de 8→9 itens:
  - Portas/URLs de infraestrutura derivados de `setup.ts` ou `process.env`, nunca hardcoded

#### architect
- Self-check expandido de 10→11 itens:
  - Dependências com versão compatível com a stack alvo (verificar peer deps)

### Impact
Previne recorrência de W1 (non-null env), W2 (raw process.env), W3 (fetch raw), W4 (tipos duplicados), W7 (porta hardcoded) e rate-limit version bug em features futuras.

## 2026-08-06 — Refinamento pós Feature #1 (Conta + Personagem)

### Trigger
Feature #1 passou com score 4.5/5.0 após 1 ciclo de correção (inicial: 4.0, security 4.0). Code-reviewer identificou 3 padrões de falha:
- **Issue #3**: `toPublicCharacter()` criada em 2 lugares (duplicação de código)
- **Issue #4**: Zod schema de senha sem constraints de complexidade (validação incompleta)
- **Issue #5**: Teste de refresh concorrente ausente (cobertura de concorrência limitada a economia)

### Changes

#### developer
- Check #5 refinado: `Validação de input (Zod schema)` → `Zod schema com constraints reais: complexidade de senha, ranges, formatos`
- Novo check #19: DRY interno — funções utilitárias, tipos e constantes não duplicados dentro da própria feature (extrair para lib/ ou utils/ compartilhado)

#### test-writer
- Check #5 ampliado: `race conditions em economia` → `race conditions em economia, refresh de tokens, sessões simultâneas`

### Impact
Previne duplicação de utilitários, validação Zod incompleta e gaps de cobertura de concorrência não-econômica em features futuras.
