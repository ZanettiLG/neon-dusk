# Orquestração e Agentes

## Modelo de Orquestração

O desenvolvimento do Neon Dusk segue um padrão de **orquestrador + workers especializados**, herdado do AlphaLessons:

```
Human Dev: /dev-feature "sistema de autenticação JWT"
  └── build agent (entrada fina, <200 linhas)
        └── dev-orchestrator (contexto isolado)
              ├── [Passo 1] architect → design de schema, API, fluxo
              ├── [Passo 2] developer → implementação (backend + frontend)
              ├── [Passo 3] test-writer → testes automatizados
              ├── [Passo 4] code-reviewer → revisão de qualidade
              ├── [Passo 5] [se score < 4.5] → re-executar Passo 2
              └── [Passo 6] harness-engineer → refinar harness com feedback
```

### Pipeline de Feature (6 passos)

| Passo | Agente | Entrada | Saída |
|---|---|---|---|
| 1. **Design** | `architect` | Descrição da feature + docs de produto | Schema, contratos de API, arquitetura de arquivos |
| 2. **Implement** | `developer` | Design do architect + skills de stack | Código implementado (back + front) |
| 3. **Test** | `test-writer` | Código implementado + design | Testes automatizados |
| 4. **Review** | `code-reviewer` | Código + testes + design | Score (1-5) em 6 critérios + ações corretivas |
| 5. **Decide** | `dev-orchestrator` | Score do reviewer | Aprovar, corrigir, ou re-planejar |
| 6. **Refine** | `harness-engineer` | Feedback do reviewer | Ajustes em agents/skills (se score < 4.8) |

---

## Catálogo de Agentes

### Agentes Core (7 agentes)

---

### 1. `dev-orchestrator` — Orquestrador de Desenvolvimento

| Atributo | Valor |
|---|---|
| **Modelo** | `deepseek-v4-pro`, temperature 0.2, thinking 16K |
| **Modo** | `all` (primário + subagent) |
| **Permissões** | edit: deny, write: deny, bash: deny |
| **Skills** | `neon-dusk-design`, `continual-harness-dev` |
| **Função** | Coordena o pipeline de feature. Recebe intenção do dev humano, delega para workers, toma decisões de fluxo. NUNCA escreve código. |
| **Pipeline** | Design → Implement → Test → Review → Decide → Refine |
| **Gate de qualidade** | Score do reviewer ≥ 4.5 na menor nota. Máximo 3 ciclos de re-execução |
| **Handoff** | Usa `.handoff/nd-<run_id>/` para outputs intermediários |

**Regras de delegação**:
- `architect` → design de sistema (NUNCA faz design inline)
- `developer` → implementação de código
- `test-writer` → testes
- `code-reviewer` → revisão
- `harness-engineer` → refinar agents/skills
- `deep-researcher` → pesquisa técnica/lore
- `decision-agent` → decisões complexas com trade-offs

---

### 2. `architect` — Arquiteto de Software

| Atributo | Valor |
|---|---|
| **Modelo** | `deepseek-v4-pro`, temperature 0.1, thinking 32K |
| **Modo** | `subagent`, hidden: true |
| **Permissões** | edit: deny, bash: deny, write: allow (handoff apenas) |
| **Skills** | `neon-dusk-design`, `nodejs-patterns`, `sql-design` |
| **Função** | Produz design técnico a partir de uma feature descrita. NÃO escreve implementação. |

**Entrada** (JSON):
```json
{
  "feature": "descrição da feature",
  "affected_systems": ["backend", "frontend", "database"],
  "constraints": ["MVP-only", "pwa-mobile-first"],
  "related_docs": ["docs/cyber-rpg/definicoes-de-produto/03-mecanicas-core.md"]
}
```

**Saída** (handoff em `.handoff/nd-<run_id>/design.md`):
- Schema de banco (migrations SQL)
- Contratos de API (endpoints, request/response)
- Estrutura de arquivos a criar/modificar
- Fluxo de dados (backend → frontend)
- Decisões de arquitetura (ADR-style)
- Estimativa de complexidade
- Lista de arquivos existentes afetados

**Self-check (10 itens)**:
- [ ] Schema usa tipos corretos (UUID, timestamps, enums)
- [ ] APIs seguem REST (ou justifica desvio)
- [ ] Nenhuma feature do roadmap Fase 2+ referenciada sem justificativa
- [ ] Compatível com PostgreSQL (sem syntax MySQL-only)
- [ ] Índices justificados para queries previstas
- [ ] PWA-first (rotas funcionam sem JS server-side quando possível)
- [ ] Consistente com docs de produto (verifica `definicoes-de-produto/`)
- [ ] Nenhuma dependência nova não listada
- [ ] Migrations são reversíveis (down migration)
- [ ] Autenticação/autorização consideradas (se aplicável)

---

### 3. `developer` — Desenvolvedor Full-Stack

| Atributo | Valor |
|---|---|
| **Modelo** | `deepseek-v4-flash`, temperature 0.3, thinking 16K |
| **Modo** | `subagent`, hidden: true |
| **Permissões** | edit: allow, write: allow, bash: allow (npm, git, lint) |
| **Skills** | `neon-dusk-design`, `nodejs-patterns`, `vue-patterns`, `sql-design`, `game-economy` |
| **Função** | Implementa features conforme design do architect. Full-stack: backend TypeScript, migrations, frontend React, PWA. |

**Entrada**: handoff do architect (`design.md`) + descrição da feature

**Processo**:
1. Ler design.md
2. Ler arquivos existentes afetados
3. Implementar backend (models, services, routes, middleware)
4. Implementar database (migrations, seeds)
5. Implementar frontend (components, views, stores, PWA config)
6. Rodar linter e type-check
7. Self-review automatizado (15 checks)
8. Handoff do código

**Self-review (15 checks)**:
- [ ] TypeScript strict: zero `any` (exceto justificado com `// @ts-expect-error`)
- [ ] Todas as queries SQL usam parameterized queries (nunca string interpolation)
- [ ] Redis operations têm TTL definido
- [ ] Tratamento de erro em TODAS as rotas (try/catch + error middleware)
- [ ] Validação de input (Zod ou similar)
- [ ] Consistência de nomeação (camelCase JS/TS, snake_case SQL, kebab-case arquivos)
- [ ] Nenhum segredo hardcoded (usa `process.env`)
- [ ] CORS configurado corretamente
- [ ] Rate limiting em rotas públicas
- [ ] Migrations são idempotentes (IF NOT EXISTS)
- [ ] Frontend: PWA manifest + service worker registrados
- [ ] Frontend: responsivo (testado em 320px, 768px, 1024px)
- [ ] Frontend: paleta de cores segue `01-visao-e-marca.md`
- [ ] Nenhum console.log em produção (usa logger)
- [ ] README ou docstring em funções públicas

**Regra de worker**: nunca spawna `developer` (anti-auto-spawn). Pode spawnar `general` para tarefas triviais (buscar arquivo, rodar comando).

---

### 4. `test-writer` — Escritor de Testes

| Atributo | Valor |
|---|---|
| **Modelo** | `deepseek-v4-flash`, temperature 0.1, thinking 8K |
| **Modo** | `subagent`, hidden: true |
| **Permissões** | edit: allow, write: allow, bash: allow (vitest, npm test) |
| **Skills** | `testing-patterns` |
| **Função** | Escreve testes automatizados para features implementadas. |

**Tipos de teste que produz**:
- **Unitários** (Vitest): services, utils, game logic (economy math, stat calculations)
- **Integração** (Vitest + Supertest): API endpoints
- **E2E** (Playwright): fluxos críticos (login → criar personagem → primeiro trampo)
- **Database** (Vitest + pg-mem ou testcontainers): migrations, queries

**Self-check (8 itens)**:
- [ ] Cobertura de caminho feliz E caminhos de erro
- [ ] Testes de rate limiting
- [ ] Testes de autorização (usuário sem permissão → 403)
- [ ] Testes de validação de input (dados inválidos → 400)
- [ ] Testes de concorrência (se aplicável: race conditions em economia)
- [ ] Testes rodam sem dependências externas (mock ou testcontainers)
- [ ] Seeds de teste isolados (não poluem dados de dev)
- [ ] Todos os testes passam (`npm test`)

---

### 5. `code-reviewer` — Revisor de Código

| Atributo | Valor |
|---|---|
| **Modelo** | `deepseek-v4-pro`, temperature 0.1, thinking 32K |
| **Modo** | `subagent`, hidden: true |
| **Permissões** | read: allow, todos outros deny |
| **Skills** | `neon-dusk-design`, `nodejs-patterns`, `vue-patterns`, `sql-design` |
| **Função** | Avalia qualidade do código implementado. Read-only. Gera score e recomendações. |

**6 Critérios de Avaliação** (cada um nota 1-5):

| Critério | O que avalia |
|---|---|
| **1. Correção** | O código faz o que o design especifica? Bugs óbvios? |
| **2. Segurança** | SQL injection, XSS, CSRF, auth bypass, secrets expostos? |
| **3. Performance** | N+1 queries, índices faltando, Redis caching adequado? |
| **4. Manutenibilidade** | Código claro, DRY sem over-engineering, nomes significativos? |
| **5. Consistência** | Segue padrões do projeto? Nomeação, estrutura de arquivos? |
| **6. Cobertura de Testes** | Testes cobrem casos críticos? Testes passam? |

**Score de decisão**: MENOR nota entre os 6 critérios (não a média).

| Menor nota | Ação |
|---|---|
| = 5.0 | Aprovado sem ressalvas |
| 4.5 - 4.9 | Aprovado com correções menores (auto-aplicáveis) |
| 3.5 - 4.4 | Revisão necessária. Corrigir e re-revisar |
| < 3.5 | Reprovado. Re-planejar com architect |

**Output**: handoff em `.handoff/nd-<run_id>/review.md` com score detalhado + ações corretivas específicas (arquivo:linha).

---

### 6. `db-designer` — Designer de Banco de Dados

| Atributo | Valor |
|---|---|
| **Modelo** | `deepseek-v4-pro`, temperature 0.1, thinking 16K |
| **Modo** | `subagent`, hidden: true |
| **Permissões** | edit: deny, write: allow (migrations), bash: deny |
| **Skills** | `sql-design`, `game-economy` |
| **Função** | Especialista em schema design para games. Chamado pelo architect ou diretamente para features pesadas em banco. |

**Especialidades**:
- Schema para jogos multiplayer (tabelas de sessão, inventário, economia)
- Migrations com rollback
- Índices para queries de ranking/leaderboard
- Constraints e triggers para integridade de economia de jogo
- Soft-deletes e auditoria (transações de Grana)
- Particionamento para logs de alta escrita (eventos de jogo)

---

### 7. `game-logic-dev` — Desenvolvedor de Lógica de Jogo

| Atributo | Valor |
|---|---|
| **Modelo** | `deepseek-v4-pro`, temperature 0.2, thinking 16K |
| **Modo** | `subagent`, hidden: true |
| **Permissões** | edit: allow, write: allow, bash: allow (test only) |
| **Skills** | `game-economy`, `neon-dusk-design`, `testing-patterns` |
| **Função** | Especialista em implementar mecânicas de jogo (fórmulas de combate, economia, cyberpsychosis, progressão). Chamado para features de game design puro. |

**Exemplos de features deste agente**:
- Fórmula de sucesso de trampos: `(BOD + REF + Cromo) / Dificuldade`
- Cálculo de Humanidade e thresholds de cyberpsychosis
- Distribuição de saque por tier
- Sistema de Moral e decay
- Balanceamento de economia (faucets/sinks)
- Eventos de temporada (Corp War, Apagão)

**Self-check (8 itens específicos de game logic)**:
- [ ] Economia balanceada (faucet < sink em estado estacionário)
- [ ] Anti-grind: retornos decrescentes implementados
- [ ] PvP não permite farming infinito (cooldowns, tetos)
- [ ] Progressão é perceptível nas primeiras 24h de jogo
- [ ] Fórmulas são determinísticas (mesma entrada = mesma saída)
- [ ] Testes unitários cobrem edge cases (divisão por zero, overflow, valores negativos)
- [ ] Cyberpsychosis não pune desproporcionalmente builds específicas
- [ ] Timing de rodada (14 dias) é respeitado nos cálculos de progressão

---

## Agentes de Suporte (5 agentes — herdados/adaptados)

| Agente | Origem | Adaptação para Neon Dusk |
|---|---|---|
| **`deep-researcher`** | AlphaLessons | Investiga tópicos técnicos (APIs, bibliotecas, patterns) e lore cyberpunk. Mantido como está |
| **`harness-engineer`** | AlphaLessons | Modifica agents/skills de desenvolvimento. Adaptado para carregar `continual-harness-dev` ao invés de `continual-harness` |
| **`decision-agent`** | AlphaLessons | Decisões complexas de arquitetura/stack. Mantido como está (Claude Opus, minimal prompt) |
| **`pdf-extractor`** | AlphaLessons | Extrai conteúdo de PDFs (game design docs, referências visuais). Mantido como está |
| **`general`** | OpenCode built-in | Tarefas triviais: buscar arquivo, rodar linter, verificar dependências. Usado por workers para paralelismo |

---

## Model Tiering

| Modelo | Uso | Agentes |
|---|---|---|
| **`deepseek-v4-pro`** | Estratégia, design, revisão, lógica de jogo | `dev-orchestrator`, `architect`, `code-reviewer`, `db-designer`, `game-logic-dev` |
| **`deepseek-v4-flash`** | Volume de código, testes, pesquisa | `developer`, `test-writer`, `deep-researcher` |
| **`minimax-m3`** | Visão (extrair conteúdo visual) | `pdf-extractor` |
| **`claude-opus-4-8`** | Decisões complexas sem viés | `decision-agent` |

### Por que Pro para game-logic-dev?

Lógica de jogo é **matemática + design**, não volume de código. Fórmulas de economia, balanceamento e progressão exigem raciocínio preciso — o modelo Pro sem thinking seria inadequado; o Pro com thinking de 16K captura sutilezas como inflação, feedback loops econômicos e fairness.

### Por que Flash para developer?

A maior parte do código é **CRUD + wiring**: models, controllers, rotas, componentes React. Volume alto, complexidade baixa. Flash é mais rápido e barato. O reviewer (Pro) pega os erros.

---

## Regras de Delegação

| Agente | Pode spawnar | NUNCA pode spawnar |
|---|---|---|
| `dev-orchestrator` | architect, developer, test-writer, code-reviewer, harness-engineer, db-designer, game-logic-dev, deep-researcher, decision-agent | dev-orchestrator, general (para produção de código) |
| `architect` | db-designer, deep-researcher | architect, developer |
| `developer` | general (tarefas triviais apenas) | developer, architect |
| `game-logic-dev` | general (test only) | game-logic-dev, architect |
| `code-reviewer` | NENHUM (read-only) | qualquer |
| `test-writer` | NENHUM | qualquer |
| `harness-engineer` | general (verificação) | harness-engineer |
| `deep-researcher` | general (pesquisa paralela, máx 5) | deep-researcher |

### Golden Rule

> **Nenhum agente spawna outro agente do MESMO tipo.** Spawnar mesmo tipo causa degradação de contexto linear e loops infinitos. Violação = bug crítico de harness.
