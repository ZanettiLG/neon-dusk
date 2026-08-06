# Arquitetura de Contexto

## 3 Camadas de Isolamento

Herdado do AlphaLessons, adaptado para desenvolvimento de software:

```
┌─────────────────────────────────────────────┐
│ CAMADA 1: ENTRY                              │
│ build agent (comando)                        │
│ Contexto: <200 linhas                         │
│ Função: parse input → delegar                 │
│ NUNCA: carrega skills, vê código, decide     │
└──────────────────┬──────────────────────────┘
                   │ task()
┌──────────────────▼──────────────────────────┐
│ CAMADA 2: SYNTHESIS                          │
│ dev-orchestrator                             │
│ Contexto: ~500 linhas                         │
│ Função: coordenar pipeline, decidir fluxo     │
│ Carrega: neon-dusk-design, continual-harness │
│ NUNCA: escreve código, edita arquivos        │
└──────────────────┬──────────────────────────┘
                   │ task() [workers paralelos]
┌──────────────────▼──────────────────────────┐
│ CAMADA 3: EXECUTION                          │
│ architect, developer, test-writer, etc.      │
│ Contexto: isolado por worker                  │
│ Função: produzir artefato específico          │
│ Carrega: skills relevantes à task            │
│ Pode: escrever código, rodar testes, lint    │
└─────────────────────────────────────────────┘
```

### Por que 3 camadas?

| Camada | Problema que resolve |
|---|---|
| **Entry** | Build agent limpo — nunca poluído com contexto de features anteriores. Segurança: não pode modificar código |
| **Synthesis** | Orquestrador isolado — carrega SÓ o que precisa para coordenar. Não vê código (handoff por arquivo) |
| **Execution** | Workers limpos — cada worker recebe task específica + skills relevantes. Contexto não acumula entre features |

---

## Sistema de Handoff

Outputs grandes (>500 linhas) NUNCA são retornados inline. Vão para `.handoff/nd-<run_id>/`:

```
.handoff/nd-20260805-142230-auth-system/
├── design.md              # Output do architect
├── implementation-log.md  # Log do developer (arquivos criados/modificados)
├── test-report.md         # Output do test-writer
└── review.md              # Score + ações corretivas
```

### Namespace

- **Formato**: `nd-YYYYMMDD-HHMMSS-<feature-slug>`
- **`nd-`**: prefixo "neon dusk" (distingue de handoffs AlphaLessons que usam só timestamp)
- **Limpeza**: diretório removido após feature aprovada (score ≥ 4.5). Log registrado em `.handoff/features/YYYY-MM-DD.md`

---

## Estrutura de Diretórios do Projeto

```
neon-dusk/
├── .opencode/                    # Harness de desenvolvimento
│   ├── agents/
│   │   ├── dev-orchestrator.md
│   │   ├── architect.md
│   │   ├── developer.md
│   │   ├── test-writer.md
│   │   ├── code-reviewer.md
│   │   ├── db-designer.md
│   │   └── game-logic-dev.md
│   ├── skills/
│   │   ├── neon-dusk-design/     # Symlink para docs/cyber-rpg/definicoes-de-produto/
│   │   ├── game-economy/
│   │   ├── cyberpunk-lore/
│   │   ├── nodejs-patterns/
│   │   ├── sql-design/
│   │   ├── vue-patterns/
│   │   ├── testing-patterns/
│   │   └── continual-harness-dev/
│   ├── commands/
│   │   ├── dev-feature.md
│   │   ├── dev-review.md
│   │   ├── dev-refactor.md
│   │   ├── dev-debug.md
│   │   ├── dev-research.md
│   │   ├── dev-lore.md
│   │   ├── dev-schema.md
│   │   └── refine-dev-harness.md
│   ├── AGENTS.md                 # Regras de autogestão do harness
│   ├── changelog.md              # Histórico de mudanças estruturais
│   ├── agents-changelog.md       # Histórico de mudanças em agentes
│   └── opencode.json             # Config do OpenCode
├── src/                          # Código fonte
│   ├── server/                   # Backend (Fastify)
│   │   ├── models/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── game-logic/           # Fórmulas de mecânicas
│   │   └── index.ts
│   ├── client/                   # Frontend (React 19)
│   │   ├── api/
│   │   ├── components/
│   │   ├── views/
│   │   ├── router/
│   │   ├── stores/               # Zustand
│   │   ├── lib/
│   │   └── App.tsx
│   └── shared/                   # Tipos compartilhados
│       └── types.ts
├── db/                           # Migrations e seeds
│   ├── migrations/
│   └── seeds/
├── tests/                        # Testes (Vitest)
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
├── docs/                         # Documentação
│   └── cyber-rpg/
│       ├── pesquisa-de-mercado/
│       ├── definicoes-de-produto/
│       └── sistema-de-desenvolvimento/   ← você está aqui
├── .handoff/                     # Handoff temporário (gitignored)
│   └── nd-<run_id>/
├── AGENTS.md                     # Entry point (build agent)
├── opencode.json                 # Config raiz (symlink para .opencode/opencode.json)
├── package.json
└── README.md
```

---

## opencode.json (Config do Projeto)

```json
{
  "model": "opencode-go/deepseek-v4-flash",
  "instructions": ["AGENTS.md"],
  "subagent_depth": 3,
  "default_agent": "dev-orchestrator",
  "permission": {
    "edit": "allow",
    "bash": "allow",
    "write": "allow",
    "webfetch": "allow",
    "websearch": "allow",
    "question": "ask",
    "skill": "allow",
    "task": "allow",
    "read": {
      "allow": ["*"],
      "deny": [".env", ".env.*", "*.secret"]
    },
    "external_directory": {
      "allow": [".handoff/"]
    }
  },
  "agents": {
    "dev-orchestrator": {
      "model": "opencode-go/deepseek-v4-pro",
      "temperature": 0.2,
      "mode": "all",
      "permission": {
        "edit": "deny",
        "write": "deny",
        "bash": "deny"
      }
    }
  },
  "compaction": {
    "auto": true,
    "prune": true,
    "reserved_tokens": 10000
  }
}
```

---

## AGENTS.md (Entry Point)

```markdown
# Neon Dusk — Agente de Desenvolvimento

Ambiente de desenvolvimento do jogo Neon Dusk, orquestrado por agentes de código OpenCode.

## Princípios

1. **Delegação obrigatória** — o build agent NUNCA escreve código. Delega para `dev-orchestrator`
2. **Skills sob demanda** — conhecimento de domínio vive em skills, não no system prompt
3. **Qualidade com gate** — feature só é concluída com score ≥ 4.5 do `code-reviewer`
4. **Auto-refinamento** — o harness se auto-melhora a cada feature entregue

## Stack

- **Backend**: Node.js + TypeScript + Fastify + PostgreSQL + Redis
- **Frontend**: React 19 + Zustand + Tailwind CSS + PWA (Vite)
- **Testes**: Vitest + Supertest + Playwright (E2E)

## Documentação de Produto

Sempre consulte `docs/cyber-rpg/definicoes-de-produto/` antes de implementar qualquer feature. A documentação de produto é a fonte canônica do que o jogo É.

## Comandos

- `/dev-feature` — Pipeline completo de feature
- `/dev-review` — Revisar código
- `/dev-refactor` — Refatorar
- `/dev-debug` — Debuggar
- `/dev-research` — Pesquisar tópico
- `/dev-lore` — Gerar conteúdo narrativo
- `/dev-schema` — Design de banco
- `/refine-dev-harness` — Refinar harness

## Quando Pedir Ajuda ao Humano

- `decision-agent` recomendar `requires_human_approval: true`
- `code-reviewer` der score < 3.5 por 3 ciclos consecutivos
- Mudança estrutural no harness (novo agente, nova skill)
- Decisão de escopo (MVP vs Fase 2)
- Dúvida sobre mecânica de jogo não documentada
```

---

## Convenções de Handoff

### Direto vs Arquivo

| Tamanho do output | Método |
|---|---|
| <500 linhas | Retornar inline no resultado da task |
| ≥500 linhas | Escrever em `.handoff/nd-<run_id>/<artefacto>.md`, retornar path + summary |

### Exemplo de Retorno de Worker

```json
{
  "status": "success",
  "artefact": "design",
  "handoff_path": ".handoff/nd-20260805-142230-auth-system/design.md",
  "summary": "Sistema de autenticação JWT: 3 endpoints, 2 migrations, 4 arquivos afetados",
  "warnings": ["Refresh token rotation ainda não implementado — será Fase 2"]
}
```

---

## Ciclo de Auto-Refinamento

Após CADA feature concluída com score < 4.8, o `harness-engineer` analisa:

1. **Padrões de falha**: quais checks do reviewer falham consistentemente?
2. **Sugestões do reviewer**: o reviewer sugeriu melhorias no harness?
3. **Métricas**: score médio das últimas 5 features está subindo ou estagnando?

**Ações automáticas** (nível N1):
- Adicionar check ao self-review do developer
- Atualizar skill com novo padrão
- Ajustar prompt do agente para incluir instrução específica

**Ações com aprovação** (nível N2):
- Criar novo agente especializado
- Reestruturar pipeline
- Mudar modelo de agente

**Ações proibidas sem humano** (nível N3):
- Mudar gate de qualidade (score mínimo)
- Alterar stack tecnológica
- Redesenhar arquitetura de contexto

**Limite de segurança**: 3 ciclos sem melhoria → parar e pedir ajuda.
