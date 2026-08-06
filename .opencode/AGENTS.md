# Neon Dusk — Auto-Gestão do Harness de Desenvolvimento

## Padrão: Carregamento de Contexto por Escopo

O OpenCode carrega `AGENTS.md` recursivamente — quando você acessa um diretório, qualquer `AGENTS.md` dentro dele é carregado no contexto. Este arquivo só entra em contexto quando você está lidando com o harness de desenvolvimento.

## Princípio de Carregamento de Contexto

Nem todo conhecimento precisa estar em `AGENTS.md`. O contexto obrigatório é orquestração — o que fazer e onde encontrar. Conhecimento especializado é carregado sob demanda via skills.

| O quê | Onde | Como acessar |
|---|---|---|
| Orquestração do projeto | `AGENTS.md` (raiz) | Sempre carregado |
| Auto-gestão do agente | `.opencode/AGENTS.md` (este arquivo) | Carregado ao acessar `.opencode/` |
| Conhecimento injetável | `.opencode/skills/` | `skill` (sob demanda) |
| Agentes especializados | `.opencode/agents/` | `task` |
| Comandos | `.opencode/commands/` | `/comando` |
| Documentação de produto | `docs/cyber-rpg/definicoes-de-produto/` | `read` (sob demanda) |
| Histórico de evolução | `.opencode/changelog.md` | Consulte para contexto de mudanças |

### Regra de Ponderação

Antes de adicionar algo ao contexto obrigatório:

1. **É necessário para TODAS as tarefas?** → `AGENTS.md` raiz
2. **É necessário apenas no harness?** → `.opencode/AGENTS.md` (este arquivo)
3. **É conhecimento especializado?** → skill carregada sob demanda
4. **É documentação de produto?** → `docs/cyber-rpg/definicoes-de-produto/`
5. **É registro histórico?** → `.opencode/changelog.md`

**Nunca duplique conhecimento entre camadas.**

## Princípio do Papel (Role), Não Persona

Agentes são definidos pelo **que fazem** (papel/função), não por **quem são** (persona/identidade). Um agente não é um "ninja do código" — é um "desenvolvedor full-stack". Um agente não é um "xerife digital" — é um "revisor de código".

### Regra
O nome do agente, descrição e prompt devem responder a **uma** pergunta: "o que este agente **faz**?"

**Idioma das descrições**: O campo `description` no frontmatter YAML de agents, skills e commands deve estar sempre em inglês. O corpo do prompt pode estar em português (Brasil).

## Princípio da Delegação

Orquestradores delegam. Workers executam. Nenhum agente spawna outro do mesmo tipo.

### Regras de Spawn

| Agente | Pode spawnar | NUNCA spawnar |
|---|---|---|
| `dev-orchestrator` | architect, developer, test-writer, code-reviewer, db-designer, game-logic-dev, harness-engineer, deep-researcher, decision-agent, github-ops, pr-reviewer | dev-orchestrator |
| `architect` | db-designer, deep-researcher | architect, developer |
| `developer` | general (tarefas triviais) | developer, architect |
| `game-logic-dev` | general (test only) | game-logic-dev |
| `code-reviewer` | NENHUM | qualquer |
| `test-writer` | NENHUM | qualquer |
| `harness-engineer` | general (verificação) | harness-engineer |
| `github-ops` | NENHUM | github-ops |
| `pr-reviewer` | github-ops (para comentar/aprovar) | pr-reviewer |

## Modificação do Harness

Para modificar agents, skills, comandos ou config:

1. Use `/refine-dev-harness` (NUNCA edite diretamente)
2. Se urgente, use `task(harness-engineer, ...)` com descrição precisa
3. Mudanças N3 (estruturais) requerem aprovação humana
4. Registre toda mudança nos changelogs

### Estrutura do `.opencode/`

```
.opencode/
├── agents/          # Agentes de desenvolvimento
├── skills/          # Skills de conhecimento
├── commands/        # Comandos CLI
├── AGENTS.md        # Este arquivo
├── changelog.md     # Mudanças estruturais
└── agents-changelog.md  # Mudanças em agentes
```
