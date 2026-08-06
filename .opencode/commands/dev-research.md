---
description: Research a technical topic exhaustively. Investigates documentation, community, and code to produce structured reports with recommendations.
agent: build
subtask: false
---

# /dev-research — Pesquisar Tópico

Pesquisa técnica exaustiva com relatório e recomendação.

## Uso

```
/dev-research "Melhor ORM para PostgreSQL em 2026: Drizzle vs Knex vs Prisma"
/dev-research "Como implementar SSE com Fastify para notificações"
/dev-research "Padrões de rate limiting para APIs de jogos multiplayer"
```

## Workflow

```
build agent → task(deep-researcher, $ARGUMENTS)
  └── [se decisão necessária] → task(decision-agent, opções + critérios)
```

## Output
Relatório estruturado: sumário, achados, lacunas, fontes, recomendação.

## Regras
- Usar `decision-agent` apenas se houver trade-off entre opções
- Fontes sempre citadas com URL
