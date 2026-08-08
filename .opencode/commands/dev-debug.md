---
description: Debug an issue by investigating root cause, applying fix, adding regression test, and reviewing.
agent: build
subtask: false
---

# /dev-debug — Debuggar Issue

Investiga, corrige e previne regressão de bugs. Por padrão, cria issue de bug + branch `fix/` e segue pipeline GitHub-native.

## Uso

```
/dev-debug "Erro 500 ao criar gig com TEC < 3"
/dev-debug "Timeout no leaderboard com >1000 jogadores"
/dev-debug "Stims não aplicam burnout após expirar" --local
```

## Flags

| Flag | Efeito |
|---|---|
| `--local` | Pipeline local, sem GitHub (sem issue, branch, PR) |

## Workflow

```
build agent → task(dev-orchestrator, "debug: $ARGUMENTS")
  ├── github-ops → criar issue (label: bug) + branch (fix/<issue>-<slug>)
  ├── deep-researcher → investiga logs, código, stack trace
  ├── developer → aplica fix
  ├── github-ops → commit + push
  ├── test-writer → adiciona teste de regressão
  ├── code-reviewer → verifica fix
  ├── github-ops → criar PR
  └── pr-reviewer → auditar PR
  
  Passos GitHub pulados com --local.
```

## Regras
- Sempre adicionar teste de regressão
- `deep-researcher` investiga antes de corrigir
- Commit segue: `fix(<scope>): <descrição> (fixes #<issue>)`
