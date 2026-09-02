# ADR 0004 — Território mínimo e endpoint agregado do mapa

**Status**: aceito (registro de decisão; não reabrir)
**Data**: 2026-09-02
**Issue**: #18

## Contexto

A visualização do mapa do metrô (tela de distritos) precisa mostrar, por distrito: trampos disponíveis (catálogo estático), calor do personagem (com decay aplicado) e o bonde que domina a área. Três leituras em três endpoints diferentes custariam 3 requisições por renderização da tela e espalhariam a agregação pelo cliente. Paralelamente, o território de bonde é uma mecânica nova sem design fechado (Guerra de Bondes, bônus e reset por rodada são Fase 2) — implementar a mecânica completa agora seria escopo creep.

## Decisão

1. **Endpoint agregado**: `GET /api/metro` retorna um `MetroDistrictInfo` por distrito, na ordem canônica de `ORIGINS`, com `gigsAvailable`, `heat` (decay aplicado lazy na leitura, NUNCA escrito de volta) e `territoryCrewTag` (ou `null`). O cliente deriva os props do mapa sem normalização adicional.
2. **Território mínimo**: `crews.territory_district` (nullable `public.origin`) é reivindicado na criação do bonde, silenciosamente, a partir do distrito de origem do líder — se o distrito já estiver ocupado, o bonde simplesmente não reivindica nada (sem erro). Índice único parcial (`WHERE territory_district IS NOT NULL`) garante no máximo um bonde por distrito. A vaga é liberada quando o bonde dissolve.
3. **Fora de escopo** (Fase 2, sem implementação agora): Guerra de Bondes (disputa entre bondes), bônus de território (+10%/+5%), reset de território a cada 2 semanas e leaderboard por distrito.

## Consequências

- Positivo: uma única fetch por renderização do mapa; agregação server-side com fonte única de dados; regra de território mínima (1 linha na transação de criação) sem bloquear o design futuro — a coluna e o índice já são o contrato da mecânica completa.
- Negativo: a reivindicação única acontece no momento da fundação; bonde fundado em distrito ocupado fica sem território até a Guerra de Bondes existir (aceitável — sem impacto em gameplay atual).
- Risco aceito: `territory_district` mora na tabela `crews` (um bonde = um distrito); se a Guerra de Bondes permitir múltiplos distritos por bonde, a coluna migra para uma tabela própria (`crew_territories`) sem quebrar o endpoint — o contrato público (`territoryCrewTag`) permanece o mesmo.
