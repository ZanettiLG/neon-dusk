# Skills e Conhecimento

## Filosofia

Skills são **conhecimento injetável sob demanda**. Ao contrário de instruções no system prompt (que poluem o contexto), skills só são carregadas quando o agente precisa delas. Isto mantém o contexto limpo e permite conhecimento especializado profundo.

### Skill vs Agente vs Comando

| Elemento | Função | Exemplo |
|---|---|---|
| **Skill** | Conhecimento injetável | `sql-design` → como escrever migrations |
| **Agente** | Worker especializado + prompt | `db-designer` → agente que CARREGA `sql-design` |
| **Comando** | Entry point para humano | `/dev-feature` → dispara pipeline |

---

## Catálogo de Skills

### Skills de Domínio do Projeto

---

### `neon-dusk-design` — Documentação de Produto

| Atributo | Valor |
|---|---|
| **Arquivo** | `docs/cyber-rpg/definicoes-de-produto/` (diretório inteiro como skill) |
| **Carregado por** | `dev-orchestrator`, `architect`, `developer`, `game-logic-dev`, `code-reviewer` |
| **Conteúdo** | Visão, marca, mundo, mecânicas core, sistemas de progressão, roadmap |
| **Por que skill** | É a fonte canônica do que o jogo É. Todo agente precisa saber o que está construindo |

**Mapeamento de consulta**:

| Dúvida do agente | Seção |
|---|---|
| "Qual a paleta de cores?" | `01-visao-e-marca.md` → Identidade Visual |
| "Como funciona Moral?" | `04-sistemas-e-progressao.md` → Seção 5 |
| "Quais os distritos?" | `02-mundo-e-universo.md` → Distritos |
| "O que está no MVP?" | `05-roadmap-e-mvp.md` → Fase 1 |

---

### `game-economy` — Economia de Jogos

| Atributo | Valor |
|---|---|
| **Arquivo** | `.opencode/skills/game-economy/SKILL.md` (a ser criado) |
| **Carregado por** | `game-logic-dev`, `db-designer`, `architect` |
| **Conteúdo** | Padrões de economia para jogos multiplayer, faucets/sinks, inflação, balanceamento |

**Tópicos**:
- Faucets (fontes de moeda): gigs, hustles, vendas, loot
- Sinks (sumidouros): chrome, terapia, Resgate, housing, stims
- Inflação: instrumentação (log de todas as transações), métricas de alerta
- Preços fixos vs dinâmicos: modelo RED (8 categorias de preço fixo)
- Moeda premium: conveniência, nunca poder; comprável com moeda do jogo
- Anti-RMT (Real Money Trading): bound items, trade restrictions no MVP
- Balanceamento de rodada: economia deve zerar sem destruir progressão

---

### `cyberpunk-lore` — Lore Cyberpunk

| Atributo | Valor |
|---|---|
| **Arquivo** | `.opencode/skills/cyberpunk-lore/SKILL.md` (a ser criado) |
| **Carregado por** | `developer` (quando escrevendo copy/texto), `game-logic-dev` |
| **Conteúdo** | Vocabulário, tom, referências do universo cyberpunk para UI e narrativa |

**Tópicos**:
- Glossário cyberpunk (chrome, Grana, despachante, gig, flatline, etc.)
- Tom de voz (noir sujo, irônico, estilo Gibson)
- Referências de UI textual (como escrever descrições de implantes, mensagens de erro diegéticas)
- Frases de exemplo para cada contexto (sucesso, falha, morte, level up)
- O que NÃO fazer (linguagem corporativa, heroísmo, infantilização)

---

### Skills Técnicas (Stack)

---

### `nodejs-patterns` — Padrões Node.js/TypeScript

| Atributo | Valor |
|---|---|
| **Arquivo** | `.opencode/skills/nodejs-patterns/SKILL.md` (a ser criado) |
| **Carregado por** | `architect`, `developer`, `code-reviewer` |
| **Conteúdo** | Padrões de projeto, convenções, anti-padrões para Node.js/TypeScript |

**Tópicos**:
- Estrutura de projeto: `src/` → `models/`, `services/`, `routes/`, `middleware/`, `utils/`
- Fastify (escolhido sobre Express por performance e schema validation nativa)
- Zod para validação de input
- Knex ou Drizzle ORM para PostgreSQL (nunca raw SQL com string interpolation)
- Padrão Repository para acesso a dados
- Error handling: `AppError` class, error middleware global
- Logging: Pino (estruturado, performance)
- Config: `env.ts` com Zod validation de variáveis de ambiente
- Async/await, nunca callbacks ou `.then()` chains (exceto Promise.all)
- Injeção de dependência via constructor (testabilidade)

---

### `sql-design` — Design de Banco de Dados

| Atributo | Valor |
|---|---|
| **Arquivo** | `.opencode/skills/sql-design/SKILL.md` (a ser criado) |
| **Carregado por** | `architect`, `db-designer`, `developer` |
| **Conteúdo** | Padrões de schema, migrations, queries para PostgreSQL |

**Tópicos**:
- Nomeação: tabelas plural snake_case, colunas snake_case, PK `id`
- Timestamps: `created_at`, `updated_at` em TODA tabela
- UUIDs para PKs (nunca serial/integer para entidades principais)
- Migrations: Knex ou Drizzle Kit; sempre com `down` migration
- Índices: B-tree para buscas exatas, GIN para full-text, partial indexes para queries comuns
- Constraints: FK com ON DELETE (RESTRICT/CASCADE/SET NULL conforme semântica)
- Enums: nativos do PostgreSQL (CREATE TYPE), não strings soltas
- JSONB: para dados semi-estruturados (inventário de jogador, perks)
- Soft delete: `deleted_at` timestamp, views filtrando WHERE deleted_at IS NULL
- Connection pooling: PgBouncer ou pool nativo; transações curtas
- Anti-padrões: N+1 queries, SELECT *, missing indexes, transactions abertas longas

---

### `vue-patterns` — Padrões Vue 3 + PWA

| Atributo | Valor |
|---|---|
| **Arquivo** | `.opencode/skills/vue-patterns/SKILL.md` (a ser criado) |
| **Carregado por** | `developer`, `code-reviewer` |
| **Conteúdo** | Padrões de frontend Vue 3, PWA, responsividade |

**Tópicos**:
- Composition API (nunca Options API)
- `<script setup>` com TypeScript
- State management: Pinia (simples, TypeScript-first)
- Roteamento: Vue Router com lazy loading
- Componentes: Single File Components, props com tipos explícitos
- Estilo: Tailwind CSS com paleta customizada (cores de `01-visao-e-marca.md`)
- PWA: `vite-plugin-pwa` com manifest e service worker
- Responsivo: mobile-first (320px → 768px → 1024px)
- Tema escuro: obrigatório, aplicado via CSS variables + Tailwind `dark` class
- Fontes: monospace para dados (`Fira Code`), sans-serif para texto (`Inter`)
- Acessibilidade: contraste WCAG AA, labels em inputs, focus visível
- Performance: lazy routes, image optimization, bundle analysis

---

### `testing-patterns` — Padrões de Teste

| Atributo | Valor |
|---|---|
| **Arquivo** | `.opencode/skills/testing-patterns/SKILL.md` (a ser criado) |
| **Carregado por** | `test-writer`, `code-reviewer` |
| **Conteúdo** | Estratégias de teste, ferramentas, convenções |

**Tópicos**:
- Vitest como test runner (compatível com Vite, rápido)
- Unitários: funções puras, services mockados
- Integração: Supertest para APIs Fastify
- Database: `pg-mem` para testes unitários de queries; testcontainers para integração
- Seeds de teste: `__tests__/fixtures/` com dados determinísticos
- Coverage: 80%+ em game logic, 60%+ em CRUD, 40%+ em UI
- Test naming: `describe('Feature', () => { it('should do X when Y', () => {}) })`
- Anti-padrões: testar implementação (não comportamento), testes frágeis com timers, dependências externas não mockadas

---

### `continual-harness-dev` — Auto-Refinamento do Harness de Dev

| Atributo | Valor |
|---|---|
| **Arquivo** | `.opencode/skills/continual-harness-dev/SKILL.md` (a ser criado) |
| **Carregado por** | `dev-orchestrator`, `harness-engineer` |
| **Conteúdo** | Ciclo de auto-melhoria dos agents/skills de desenvolvimento, adaptação do `continual-harness` do AlphaLessons |

**Diferenças do AlphaLessons**:
- Feedback de **code-reviewer** (não reviewer pedagógico)
- Métricas de qualidade de código (não qualidade pedagógica)
- Skills técnicas (não educacionais)
- Gate de qualidade: score ≥ 4.5 (não 4.8)

---

## Arquitetura de Carregamento de Skills

```
Agente recebe task
  └── skill("neon-dusk-design") → Carrega docs de produto (sempre)
  └── skill("nodejs-patterns") → Se task envolve backend
  └── skill("vue-patterns") → Se task envolve frontend
  └── skill("sql-design") → Se task envolve banco
  └── skill("game-economy") → Se task envolve mecânicas
  └── skill("cyberpunk-lore") → Se task envolve copy/texto
  └── skill("testing-patterns") → Se task é escrever testes
  └── skill("continual-harness-dev") → Se task é refinar harness
```

**Regra**: carregue APENAS as skills necessárias para a task. Skills não usadas = contexto poluído.
