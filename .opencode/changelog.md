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

## 2026-08-06 — Handoff GitHub-Native + PR Reviewer (QA/DevOps/Tech Lead)

### Trigger
Handoffs em arquivos `.handoff/*.md` eram frágeis (colisão entre features, sem rastreabilidade, sem integração com fluxo de mercado). Necessidade de um revisor nível QA/DevOps/Tech Lead auditando PRs, não apenas código.

### Changes
- **Filosofia**: GitHub é a fonte única de verdade. Zero arquivos `.handoff/`. Handoffs vivem como comentários em issues, corpo de issue atualizado com status, PRs como artefatos finais.
- **`github-workflow` skill**: Reescrevida para fluxo GitHub-native — issues como registros canônicos, comentários como handoffs, PR template, labels de estado (`in-progress`, `needs-review`, `approved`, `changes-requested`, `completed`)
- **`github-ops` agent**: Expandido com `comment-on-issue`, `update-issue-body`, `create-sub-issue`, `update-issue-labels`, `approve-pr`, `request-changes`. Removeu dependência de `.handoff/index.md`
- **Novo agente `pr-reviewer`**: QA/DevOps/Tech Lead. Audita PR com contexto completo (diff + handoffs da issue + design doc). 6 dimensões: código, testes, segurança, design, performance, documentação. Score mínimo 4.5/5.0. Comentários inline no PR. Approve ou Request Changes.
- **`dev-orchestrator`**: Pipeline redesenhado em 9 passos GitHub-native. Handoffs via `github-ops` comentam na issue. Passo 7: criar PR. Passo 8: `pr-reviewer` audita. Passo 9: fechamento com labels. Sem `--github`, handoffs são inline (JSON de resposta dos subagents).
- **`dev-feature`**: Adicionado `pr-reviewer` ao diagrama de workflow

### Architecture Decisions
- `pr-reviewer`: Pro (DeepSeek v4), thinking 32K — precisa de capacidade analítica profunda para auditar código + contexto
- `pr-reviewer` pode spawnar `github-ops` para comentar/aprovar PRs — ele mesmo não tem permissão write
- Score do `pr-reviewer` é independente do `code-reviewer` — code-reviewer avalia código bruto, pr-reviewer avalia o PR completo (código + testes + design + contexto)
- Labels rastreiam estado do pipeline diretamente no GitHub — sem índice externo

### Impact
Pipeline totalmente integrável com fluxo GitHub padrão. Handoffs auditáveis, rastreáveis e indexados nativamente pelo GitHub. Dupla camada de qualidade: code-reviewer (código) + pr-reviewer (PR completo).

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
