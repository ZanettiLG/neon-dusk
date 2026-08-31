# ADR 0002 — Rank-up de Moral no frontend (detecção + celebração)

**Status**: proposto
**Data**: 2026-08-31
**Issue**: #9

## Contexto
A feature #9 entrega "Saideira + Moral + leaderboard". A escada de Moral
(thresholds → títulos) vive **apenas no servidor** (`server/src/game/street-cred.ts`);
não existe em `packages/shared` nem no bundle do app. A celebração de rank-up é
uma necessidade de frontend puro: quando o corredor cruza um degrau, o app deve
mostrar o título novo sem depender de uma nova rota de API. A issue é
frontend-only — mover a ladder para `packages/shared` exigiria tocar servidor e
sairia do escopo.

## Decisão
Duplicar a ladder no frontend (`app/src/lib/street-cred.ts`, espelho exato de
`STREET_CRED_THRESHOLDS`) e detectar a subida de degrau localmente:

- `detectRankUp(info)` roda no sucesso de `fetchSC` (store de street-cred):
  compara o título vivo contra o último visto (localStorage
  `nd:last-seen-title`), sempre grava o título atual (primeira visita e decay
  também atualizam) e emite **um** evento por fetch mesmo que múltiplos degraus
  tenham sido cruzados de uma vez.
- O evento alimenta um estado `rankUp` no store, consumido por um componente
  global `RankUpCelebration` montado no `App` (junto ao `InstallPrompt`) — um
  `<Modal size="sm">` que o corredor fecha manualmente (sem auto-dismiss).
- O balcão da Saideira ganha um card diegético da Carcará (`BalcaoCard`) cuja
  citação varia com a Moral ao vivo via `carcaraQuoteFor(score)`.

## Consequências
- **Positivo**: zero mudanças em `server/` e `packages/shared/`; celebração
  instantânea sem polling extra; copy diegética consistente (Carcará fala de
  acordo com o degrau).
- **Negativo**: a ladder fica duplicada — risco de drift se o servidor mudar um
  threshold e o front não acompanhar. Mitigado por um **teste de pinagem**
  (`app/src/lib/street-cred.test.ts`) que fixa os 7 degraus (título + score) e
  falha se qualquer um divergir do contrato atual.
- **Risco aceito**: o copy dos banners de 429 no chat (códigos
  COOLDOWN_ACTIVE / RATE_LIMITED / CIRCUIT_BREAK) referencia strings que o
  server também traduz via `ptBrError`; a divergência entre as duas cópias é
  aceita porque os banners são diegéticos (tom Carcará), não traduções.
- **Upgrade path**: mover `STREET_CRED_THRESHOLDS` (e o `getTitle` do server)
  para `packages/shared` em um refactor dedicado, tornando o espelho
  desnecessário.

Confiança na decisão: 0.9.