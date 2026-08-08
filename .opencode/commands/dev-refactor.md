---
description: Refactor existing code while preserving behavior. Design the refactoring, implement, ensure tests still pass, and review.
agent: build
subtask: false
---

# /dev-refactor — Refatorar

Refatora código existente preservando comportamento. Por padrão, cria issue + branch dedicada e segue pipeline GitHub-native.

## Uso

```
/dev-refactor "Extrair lógica de validação do gig.service.ts para middleware"
/dev-refactor "Migrar character store de Options API para Composition API"
/dev-refactor "Simplificar auth middleware" --local
```

## Flags

| Flag | Efeito |
|---|---|
| `--local` | Pipeline local, sem GitHub (sem issue, branch, PR) |

## Workflow

```
build agent → task(dev-orchestrator, "refatorar: $ARGUMENTS")
  ├── github-ops → criar issue + branch (refactor/<slug>)
  ├── architect → design da refatoração
  ├── developer → implementa
  ├── github-ops → commit + push
  ├── test-writer → garante que testes existentes passam
  ├── code-reviewer → verifica preservação de comportamento
  ├── github-ops → criar PR
  └── pr-reviewer → auditar PR
  
  Passos GitHub pulados com --local.
```

## Regras
- O reviewer verifica especialmente: comportamento preservado? testes passam?
- Branch segue padrão: `refactor/<issue>-<slug>`
