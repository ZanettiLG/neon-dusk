---
description: Review existing code for quality across 6 criteria. Produces structured scores and specific corrective actions.
agent: build
subtask: false
---

# /dev-review — Revisar Código

Revisa código existente e gera score + ações corretivas.

## Uso

```
/dev-review "src/services/gig.service.ts"
/dev-review "src/server/" --full
/dev-review "migrations/0001_create_characters.ts"
```

## Flags

| Flag | Efeito |
|---|---|
| `--full` | Revisão profunda de diretório inteiro (todos os arquivos) |

## Workflow

```
build agent → task(code-reviewer, paths + flags)
```

## Output
Score (6 critérios) + ações corretivas específicas (arquivo:linha).

## Regras
- Build agent não vê o código — delega para `code-reviewer`
- `code-reviewer` é read-only — não modifica arquivos
