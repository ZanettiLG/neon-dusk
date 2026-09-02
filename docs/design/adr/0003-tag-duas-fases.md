# ADR 0003 — Tag de imagem em duas fases (candidato homolog → promoção latest)

**Status**: aceito
**Data**: 2026-09-02
**Issue**: #65

## Contexto
A entrega release-gated (#65) faz do workflow `homolog-deploy` o único trigger de
build/deploy: features mergem em `main` em silêncio, e o deploy só acontece
quando um humano promove `main → homolog` e faz push. O critério 6 da issue #65
exige que uma falha de migrate NÃO avance a tag de produção; o gap 2 do review
do PR #63 apontou que pushar `latest` no step de build avançaria a tag mesmo
com o deploy abortado (o step de build roda antes do deploy e não tem como
saber se staging validou).

## Decisão
Build em duas fases, nunca um `push` único:

- O build pusha apenas `:homolog` (candidato), para `neon-dusk-server` e
  `neon-dusk-app`.
- `:latest` é promovido via `docker buildx imagetools create` (alias da imagem
  homolog, sem rebuild) APÓS o deploy em staging validar (migrate + smoke).
- Regra operacional: nenhum build pusha `:latest`.

## Consequências
- **Positivo**: produção (`latest`, consumida pelo `deploy-prod.sh` manual) só
  avança com uma imagem validada em staging; falha antes da promoção deixa
  `latest` intacto; staging roda a tag `homolog`, com rollback por image ID para
  a `homolog` anterior.
- **Negativo/custo**: 1 step extra de promoção por deploy + a regra operacional
  de nunca pushar `latest` no build (forçada por teste estrutural do workflow).
