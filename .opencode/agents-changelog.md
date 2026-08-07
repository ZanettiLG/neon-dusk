# Agents Changelog — Neon Dusk

Histórico de mudanças nos agentes de desenvolvimento.

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
1. **Escrow-awareness**: Serviços de débito (vendor purchases, gig payouts, etc.) deveriam usar `balance - escrow`, mas o padrão não está documentado no self-review
2. **Telemetry dual-outcome**: Apenas `PVP_ATTACK` instrumentado; `PVP_DEFEAT` nunca emitido. Features com outcomes duais frequentemente instrumentam só o caminho feliz

### Changes

#### developer
- Self-review expandido de 23→25 checks:
  - #24: Débitos usam saldo disponível (`balance - escrow`), nunca `balance` bruto — aplica-se a PvP, vendor purchases, gig payouts, ou qualquer operação que reserve fundos temporariamente
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
