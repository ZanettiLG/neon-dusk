---
description: Design PostgreSQL schema for a game system. Produces migrations with up/down, indexes, and constraints for data integrity.
agent: build
subtask: false
---

# /dev-schema — Design de Schema

Projeta schema PostgreSQL para sistema de jogo.

## Uso

```
/dev-schema "Tabelas para sistema de crews e crew wars"
/dev-schema "Schema de auditoria para transações de eddies"
```

## Workflow

```
build agent → task(db-designer, $ARGUMENTS)
  └── architect → revisa consistência
```

## Output
Migrations SQL em `db/migrations/` + documentação do schema.

## Regras
- Migrations sempre com up/down
- Constraints de integridade para economia
- Índices para queries previstas
