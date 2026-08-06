# Changelog — Harness Neon Dusk

Histórico de mudanças estruturais no harness de desenvolvimento.

## 2026-08-05 — Criação Inicial

### Trigger
Setup do projeto Neon Dusk. Criação do sistema de agentes de código para desenvolvimento.

### Changes
- Criados 7 agentes core: `dev-orchestrator`, `architect`, `developer`, `test-writer`, `code-reviewer`, `db-designer`, `game-logic-dev`
- Criadas 8 skills: `neon-dusk-design`, `game-economy`, `cyberpunk-lore`, `nodejs-patterns`, `sql-design`, `vue-patterns`, `testing-patterns`, `continual-harness-dev`
- Criados 8 comandos: `dev-feature`, `dev-review`, `dev-refactor`, `dev-debug`, `dev-research`, `dev-lore`, `dev-schema`, `refine-dev-harness`
- Criados arquivos de configuração: `opencode.json`, `AGENTS.md`, `.opencode/AGENTS.md`

### Architecture Decisions
- **3 camadas de contexto**: Entry (build agent), Synthesis (dev-orchestrator), Execution (workers)
- **Model tiering**: Pro (estratégia), Flash (volume), Opus (decisões)
- **Quality gate**: score ≥ 4.5 (menor nota entre 6 critérios)
- **Handoff por arquivo**: outputs grandes em `.handoff/nd-<run_id>/`
- **Stack alvo**: Node.js + TypeScript + Fastify + PostgreSQL + Redis + Vue 3 + PWA

### Impact
Harness de desenvolvimento completo. Projeto pode iniciar implementação via comandos `/dev-*`.

## 2026-08-06 — Refinamento pós Feature 0 (Project Bootstrap)

### Trigger
Pipeline Feature 0 executado end-to-end: architect → developer → test-writer → code-reviewer → fix cycle. 6 review warnings + 1 design bug (rate-limit v9 incompatível com Fastify 5).

### Changes
- **Agentes ajustados**: developer (15→18 self-review checks), test-writer (8→9), architect (10→11) — ver `agents-changelog.md`
- **Skill `testing-patterns`**: Adicionada seção "Known Issues" documentando incompatibilidade Supertest + Fastify 5 + rate-limit, com workaround (`listen(port 0)` + `fetch`)

### Architecture Decisions
- Self-review checks crescem incrementalmente via N1 — sem refatoração estrutural
- Padrão: cada warning do reviewer que ocorrer em feature vira check de self-review no agente relevante
- Métrica inicial: 6 warnings → 4 checks adicionados. Eficácia avaliada na Feature 1

### Impact
Próximo pipeline (Feature 1: Conta + Personagem) deve ter menos warnings de higiene de código. Esperado score inicial ≥ 4.5 sem ciclo de fixes.
