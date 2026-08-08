# Neon Dusk — Build Agent

Development environment for the Neon Dusk game, orchestrated by OpenCode agents.

## Stack

- **Backend**: Node.js 22 + TypeScript + Fastify + PostgreSQL + Redis
- **Frontend**: React 19 + Zustand + Tailwind CSS + PWA (Vite)
- **Tests**: Vitest + Supertest + Playwright (E2E) + qa-browser agent (browser E2E)

## Structure

```
docs/cyber-rpg/
├── .opencode/                    # Development harness
├── pesquisa-de-mercado/          # Market analysis (The Crims + 15 games)
├── definicoes-de-produto/        # Product docs (mechanics, world, roadmap)
└── sistema-de-desenvolvimento/   # Agent system documentation
```

## Principles

1. **Mandatory delegation** — the build agent NEVER writes code. Delegate to `dev-orchestrator`
2. **Skills on demand** — domain knowledge lives in skills, not in the system prompt
3. **Quality gate** — feature is only complete with `code-reviewer` score ≥ 4.5 AND `qa-browser` passing all interactive flows
4. **GitHub-native by default** — every pipeline run creates issue, branch, commits, and PR. Use `--local` to skip GitHub integration
5. **Self-refinement** — the harness self-improves with every delivered feature
6. **Product docs are canonical** — always consult `definicoes-de-produto/` before implementing

## Commands

| Command               | Purpose                    |
| --------------------- | -------------------------- |
| `/dev-feature`        | Full feature pipeline      |
| `/dev-qa`             | E2E browser QA testing     |
| `/dev-review`         | Review code                |
| `/dev-refactor`       | Refactor                   |
| `/dev-debug`          | Debug issue                |
| `/dev-research`       | Research technical topic   |
| `/dev-lore`           | Generate narrative content |
| `/dev-schema`         | Schema design              |
| `/refine-dev-harness` | Refine harness             |

## Product Documentation

Always consult `docs/cyber-rpg/definicoes-de-produto/` before implementing any feature. The product documentation is the canonical source of what the game IS.

## When to Ask the Human for Help

- `decision-agent` recommends `requires_human_approval: true`
- `code-reviewer` scores < 3.5 for 3 consecutive cycles
- `qa-browser` reports `qa-failed` — blocker bugs in interactive flows
- Structural harness change (new agent, new skill)
- Scope decision (MVP vs Phase 2)
- Question about undocumented game mechanic
