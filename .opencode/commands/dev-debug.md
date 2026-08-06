---
description: Debug an issue by investigating root cause, applying fix, adding regression test, and reviewing.
agent: build
subtask: false
---

# /dev-debug — Debuggar Issue

Investiga, corrige e previne regressão de bugs.

## Uso

```
/dev-debug "Erro 500 ao criar gig com TEC < 3"
/dev-debug "Timeout no leaderboard com >1000 jogadores"
/dev-debug "Stims não aplicam burnout após expirar"
```

## Workflow

```
build agent → task(dev-orchestrator, "debug: $ARGUMENTS")
  ├── deep-researcher → investiga logs, código, stack trace
  ├── developer → aplica fix
  ├── test-writer → adiciona teste de regressão
  └── code-reviewer → verifica fix
```

## Regras
- Sempre adicionar teste de regressão
- `deep-researcher` investiga antes de corrigir
