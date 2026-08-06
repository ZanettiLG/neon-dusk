# Comandos e Workflows

## Comandos

Comandos são entry points acionados pelo dev humano. Cada comando dispara um pipeline de agentes.

---

### `/dev-feature` — Desenvolver Feature

**Uso**:
```
/dev-feature "Sistema de autenticação JWT com refresh tokens"
/dev-feature "Página de criação de personagem (frontend Vue)"
/dev-feature "Sistema de Street Cred e thresholds" --game-logic
```

**Pipeline**:
1. `dev-orchestrator` → recebe descrição, avalia escopo
2. `architect` → design (schema, API, arquivos)
3. `developer` → implementação (back + front)
4. `test-writer` → testes
5. `code-reviewer` → revisão
6. [se score < 4.5] → corrigir (voltar ao passo 3)
7. [se score < 4.8] → `harness-engineer` → refinar

**Flags**:
- `--frontend-only` → pula backend e banco
- `--backend-only` → pula frontend
- `--game-logic` → usa `game-logic-dev` em vez de `developer`
- `--db-only` → usa `db-designer` diretamente
- `--skip-tests` → MVP rápido (não recomendado para features core)
- `--design-only` → para no passo 2, produz apenas design doc

---

### `/dev-review` — Revisar Código Existente

**Uso**:
```
/dev-review "src/services/gig.service.ts"
/dev-review "src/" --full
```

**Pipeline**:
1. `code-reviewer` → avalia arquivos/diretório especificado
2. Output: score + ações corretivas

---

### `/dev-refactor` — Refatorar

**Uso**:
```
/dev-refactor "Extrair lógica de validação do gig.service.ts para middleware"
```

**Pipeline**:
1. `dev-orchestrator` → avalia escopo
2. `architect` → design da refatoração (o que muda, o que preserva)
3. `developer` → implementa refatoração
4. `test-writer` → garante que testes existentes ainda passam
5. `code-reviewer` → verifica se comportamento é preservado

---

### `/dev-debug` — Debuggar Issue

**Uso**:
```
/dev-debug "Erro 500 ao criar gig com TEC < 3"
```

**Pipeline**:
1. `deep-researcher` → investiga stack trace, logs, código relacionado
2. `developer` → propõe e aplica fix
3. `test-writer` → adiciona teste de regressão
4. `code-reviewer` → verifica fix

---

### `/dev-research` — Pesquisar Tópico Técnico

**Uso**:
```
/dev-research "Melhor ORM para PostgreSQL em 2026: Drizzle vs Knex vs Prisma"
/dev-research "Como implementar server-sent events com Fastify para notificações real-time"
```

**Pipeline**:
1. `deep-researcher` → investigação exaustiva
2. [se decisão necessária] → `decision-agent` → recomendar escolha
3. Output: relatório de pesquisa + recomendação

---

### `/dev-lore` — Gerar Conteúdo de Lore/Narrativa

**Uso**:
```
/dev-lore "Descrição do distrito Babilônia"
/dev-lore "3 frases de sabor para o stim AdrenaStim"
/dev-lore "Diálogo de apresentação do fixer Cupim para novos jogadores"
```

**Pipeline**:
1. `developer` (com `cyberpunk-lore` skill) → gera conteúdo
2. `code-reviewer` → verifica tom, consistência com lore

---

### `/dev-schema` — Design de Schema

**Uso**:
```
/dev-schema "Tabelas para sistema de crews e crew wars"
```

**Pipeline**:
1. `db-designer` → design de schema + migrations
2. `architect` → revisa consistência com o resto do sistema
3. Output: migrations SQL + documentação do schema

---

### `/refine-dev-harness` — Refinar Harness de Desenvolvimento

**Uso**:
```
/refine-dev-harness "Adicionar check de SQL injection ao code-reviewer"
/refine-dev-harness --auto "Refinar com base nos últimos 5 reviews"
```

**Pipeline**:
1. `harness-engineer` → analisa feedback acumulado, propõe mudanças
2. Aplica mudanças cirúrgicas em agents/skills
3. Registra em changelog

---

## Workflows de Desenvolvimento

### Workflow 1: Nova Feature (MVP)

```
Humano: /dev-feature "Sistema de criação de personagem com 5 atributos e escolha de role"

→ dev-orchestrator
  ├── Passo 1: architect
  │   ├── Lê definicoes-de-produto/04-sistemas-e-progressao.md
  │   ├── Carrega sql-design, nodejs-patterns
  │   ├── Produz: design.md (schema, API contracts, file structure)
  │   └── Self-check 10 itens
  │
  ├── Passo 2: developer
  │   ├── Lê design.md
  │   ├── Carrega nodejs-patterns, sql-design
  │   ├── Implementa: models/character.ts, routes/character.ts, migrations/001_create_characters.ts
  │   ├── Implementa: components/CharacterCreation.vue, stores/character.ts
  │   ├── Roda linter, type-check
  │   └── Self-review 15 checks → handoff code
  │
  ├── Passo 3: test-writer
  │   ├── Lê código implementado + design.md
  │   ├── Carrega testing-patterns
  │   ├── Escreve: __tests__/character.test.ts, __tests__/character-api.test.ts
  │   └── Roda npm test → todos passam
  │
  ├── Passo 4: code-reviewer
  │   ├── Lê código + testes + design.md
  │   ├── Carrega nodejs-patterns, sql-design, neon-dusk-design
  │   ├── Avalia 6 critérios
  │   ├── Output: review.md (score: 4.7, menor nota: Segurança 4.0 — input validation faltando em rota POST)
  │   └── Ações corretivas: adicionar Zod schema em POST /character
  │
  ├── Passo 5: dev-orchestrator decide
  │   ├── Score 4.7 → "aprovado com correções menores"
  │   ├── Spawna developer com instrução: "adicionar Zod validation no POST /character conforme review.md"
  │   └── developer aplica fix → re-review score 5.0
  │
  └── Passo 6: harness-engineer
      └── [score ficou 5.0 após correção → harness ok, pular]
```

---

### Workflow 2: Bug Crítico em Produção

```
Humano: /dev-debug "Timeout ao listar leaderboard com >1000 jogadores"

→ dev-orchestrator
  ├── deep-researcher
  │   ├── Investiga: logs, código da query, schema, índices
  │   ├── Encontra: SELECT sem índice na coluna street_cred, N+1 no loop de crews
  │   └── Output: bug-report.md
  │
  ├── developer
  │   ├── Fix 1: adiciona índice em street_cred
  │   ├── Fix 2: JOIN em vez de N+1 para crews
  │   └── Output: código corrigido
  │
  ├── test-writer
  │   └── Adiciona teste de performance: leaderboard com 10k jogadores < 200ms
  │
  └── code-reviewer
      └── Verifica: fix é correto, não introduz novos problemas
```

---

### Workflow 3: Game Design (Nova Mecânica)

```
Humano: /dev-feature "Sistema de leilão de chrome entre jogadores" --design-only

→ dev-orchestrator
  ├── deep-researcher → "Como funcionam mercados entre jogadores em PBBGs? Riscos de inflação?"
  ├── game-logic-dev → "Fórmula de preço dinâmico para leilão: lance mínimo, buyout, taxação"
  ├── architect → "Schema: bids, auctions, escrow de eddies"
  ├── decision-agent → "Leilão como Parte 2 (pós-MVP) ou MVP?" → Decisão: Parte 2 (população baixa no MVP = leilão vazio)
  └── Output: design-doc.md com decisão fundamentada
```

---

### Workflow 4: Refinamento Contínuo do Harness

```
Após 5 features entregues:
→ dev-orchestrator detecta padrão: "code-reviewer sempre aponta 'input validation faltando'"

→ harness-engineer (auto, nível N1)
  ├── Analisa: 5 revisões consecutivas com o mesmo problema
  ├── Propõe: adicionar "Zod validation em todas as rotas POST/PUT" ao self-review do developer (CHECK #5)
  ├── Aplica: edita agent developer, adiciona item ao checklist
  ├── Registra: agents-changelog.md
  └── Verifica: próxima feature → developer aplica validation proativamente

Resultado: score médio sobe de 4.5 para 4.8 em 3 features seguintes
```

---

## Integração com Git

| Ação | Quando | Como |
|---|---|---|
| **Branch** | Início de feature | `feature/nome-da-feature` |
| **Commit** | Após cada passo concluído | Agente faz commit atômico (ex: `feat(db): add characters migration`) |
| **PR** | Feature completa (score ≥ 4.5) | Abre PR com descrição do design + review |
| **Merge** | Após aprovação humana | Squash merge para `main` |
| **Deploy preview** | A cada PR | Vercel/Netlify preview (frontend), Railway preview (backend) |
