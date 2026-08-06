# Agents Changelog — Neon Dusk

Histórico de mudanças nos agentes de desenvolvimento.

## 2026-08-06 — N1: Prevenção de Handoff Cycles (Post-Mortem Issue #4)

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
- **Função**: Implementação full-stack. 15 checks de self-review
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
