---
description: Refine the Neon Dusk development harness based on accumulated review feedback. Analyzes failure patterns and applies surgical improvements to agents and skills.
agent: build
subtask: false
---

# /refine-dev-harness — Refinar Harness

Auto-melhoria do harness de desenvolvimento.

## Uso

```
/refine-dev-harness "Adicionar check de SQL injection ao self-review do developer"
/refine-dev-harness --auto "Refinar com base nos últimos 5 reviews"
```

## Flags

| Flag | Efeito |
|---|---|
| `--auto` | Análise automática dos padrões de falha (últimas N features) |

## Workflow

```
build agent → task(harness-engineer, $ARGUMENTS)
  ├── Analisa feedback acumulado
  ├── Propõe mudanças (nível N1/N2/N3)
  ├── Aplica edições cirúrgicas
  └── Registra em changelogs
```

## Regras
- Build agent NUNCA edita agents/skills diretamente
- N3 (estrutural) requer aprovação humana
- Máximo 3 ciclos sem melhoria → reportar
