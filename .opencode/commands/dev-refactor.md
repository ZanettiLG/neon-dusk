---
description: Refactor existing code while preserving behavior. Design the refactoring, implement, ensure tests still pass, and review.
agent: build
subtask: false
---

# /dev-refactor — Refatorar

Refatora código existente preservando comportamento.

## Uso

```
/dev-refactor "Extrair lógica de validação do gig.service.ts para middleware"
/dev-refactor "Migrar character store de Options API para Composition API"
```

## Workflow

```
build agent → task(dev-orchestrator, "refatorar: $ARGUMENTS")
  ├── architect → design da refatoração
  ├── developer → implementa
  ├── test-writer → garante que testes existentes passam
  └── code-reviewer → verifica preservação de comportamento
```

## Regras
- O reviewer verifica especialmente: comportamento preservado? testes passam?
