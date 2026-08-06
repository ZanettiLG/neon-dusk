---
name: opencode-elements
description: Complete reference of all customizable OpenCode elements (config, tools, agents, commands, formatters, permissions, MCPs, skills, custom tools, plugins, SDK, rules). Use this skill to understand how each element works or when modifying the harness.
license: MIT
compatibility: opencode
metadata:
  audience: agents
  domain: harness
---

# Elementos do OpenCode - Referência Completa

Este documento descreve todos os elementos que compõem o harness do OpenCode, organizados por categoria.

---

## 1. Config (`opencode.json`)

Arquivo JSON/JSONC na raiz do projeto.

**O que define:**
- Modelo de LLM padrão (`model`)
- Providers e opções (timeout, cache, API keys)
- Compaction (compressão automática)
- Autoupdate
- Instruções adicionais (AGENTS.md, URLs)

**Precedência:** Remote → Global → Project → Inline → Managed

---

## 2. Tools (Ferramentas)

### Built-in Tools

| Tool | Função | Perm Key |
|---|---|---|
| `bash` | Executar comandos shell | `bash` |
| `read` | Ler arquivos | `read` |
| `edit` | Editar arquivos (replace exato) | `edit` |
| `write` | Criar/sobrescrever arquivos | `edit` |
| `grep` | Buscar conteúdo com regex | `grep` |
| `glob` | Buscar arquivos por padrão | `glob` |
| `skill` | Carregar uma skill | `skill` |
| `task` | Invocar sub-agents | `task` |
| `todowrite` | Gerenciar listas de tarefas | `todowrite` |
| `webfetch` | Buscar conteúdo web | `webfetch` |
| `websearch` | Buscar na web | `websearch` |
| `question` | Perguntar ao usuário | `question` |

---

## 3. Agents (Agentes)

### Tipos
- **Primary**: Interação direta com usuário. Invocam subagents via `task`.
- **Subagent**: Invocados programaticamente. Contexto isolado.
- **All** (`mode: all`): Atua como primary E subagent.
- **System** (hidden): `compaction`, `title`, `summary` — automáticos.

### Modos (`mode`)

| Modo | Tab-ciclável | Invocável via `task` | Quando usar |
|---|---|---|---|
| `primary` | Sim | Não | Só interage com usuário |
| `subagent` | Não | Sim | Workers programáticos |
| `all` | Sim | Sim | Ambos os usos |

### Opções de Configuração

| Opção | Descrição |
|---|---|
| `description` | O que o agente faz (obrigatório, inglês) |
| `mode` | `primary`, `subagent`, `all` |
| `model` | Override do modelo LLM |
| `temperature` | 0.0 (determinístico) a 1.0 (criativo) |
| `thinking` | Configuração de thinking mode (`type: enabled`, `budgetTokens`) |
| `permission` | Controle granular de ferramentas |
| `hidden` | Esconder do autocomplete (subagents) |

### Formatos

**Markdown em `.opencode/agents/`:**
```yaml
---
description: English description here
mode: subagent
hidden: true
model: opencode-go/deepseek-v4-flash
temperature: 0.3
thinking:
  type: enabled
  budgetTokens: 16000
permission:
  edit: allow
  bash: allow
---
System prompt em português aqui.
```

---

## 4. Commands (Comandos)

Atalhos `/` no TUI.

### Opções
- `template`: Prompt enviado ao LLM (obrigatório)
- `description`: Descrição no TUI (inglês)
- `agent`: Agente executor
- `subtask`: Forçar como subagent

### Placeholders
- `$ARGUMENTS` — todos os argumentos
- `$1`, `$2` — argumentos posicionais

### Formato Markdown em `.opencode/commands/`
```markdown
---
description: English description
agent: build
subtask: false
---
Prompt template here. Use $ARGUMENTS.
```

---

## 5. Permissions (Permissões)

Controle de ações: `allow`, `ask`, `deny`.

### Granularidade
```json
{
  "permission": {
    "bash": { "*": "ask", "git *": "allow", "rm *": "deny" },
    "edit": { "*": "deny", "docs/*.md": "allow" },
    "read": { "allow": ["*"], "deny": [".env", "*.secret"] }
  }
}
```

---

## 6. MCP Servers

Integração via Model Context Protocol.

**Local:**
```json
{
  "mcp": {
    "server-name": {
      "type": "local",
      "command": ["npx", "-y", "package-name"],
      "enabled": true
    }
  }
}
```

---

## 7. Skills (Habilidades)

Conhecimento injetável sob demanda. Arquivos `SKILL.md` em `.opencode/skills/<name>/`.

### Formato
```markdown
---
name: skill-name
description: English description
license: MIT
compatibility: opencode
metadata:
  audience: agent
  workflow: development
---

## Conteúdo da Skill
```

### Nomeação
- Regex: `^[a-z0-9]+(-[a-z0-9]+)*$`
- 1-64 caracteres
- Nome da pasta = `name` no frontmatter

---

## 8. Rules (AGENTS.md)

Instruções permanentes no contexto do LLM. Localizações:
- `AGENTS.md` na raiz do projeto
- `.opencode/AGENTS.md` (carregado ao acessar `.opencode/`)
- Instruções adicionais em `opencode.json`

### Padrão de Carregamento por Escopo
O OpenCode carrega `AGENTS.md` recursivamente — ao acessar um diretório, qualquer `AGENTS.md` dentro dele é carregado.

---

## Tabela de Decisão: Que Elemento Usar?

| Necessidade | Elemento |
|---|---|
| Instruções permanentes | Rules (AGENTS.md) |
| Especialista com prompt e permissões | Agent |
| Conhecimento carregável sob demanda | Skill |
| Atalho para tarefa repetitiva | Command |
| Serviço externo (API, DB) | MCP Server |
| Controle de acesso a operações | Permissions |
