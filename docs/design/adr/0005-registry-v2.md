# ADR 0005 — Registry v2: regimes de estilo e baseline estendida

**Status**: aceito (registro de decisão; não reabrir)
**Data**: 2026-09-05
**Issue**: #190

## Contexto

O registry.json do asset-forge conhecia um único regime de estilo (noir plano
com sufixo/negative únicos) e 4 tipos: body-map, metro-map, icon e avatar. O
epic #189 (Asset Forge) exige arte gerada por IA em 2 regimes — **flat**
(assets de UI com silhueta recortável sobre fundo uniforme) e **atmospheric**
(cenas e retratos com profundidade, luz volumétrica e acento funcional por
distrito) — e curadoria por famílias com seeds nomeadas. O baseline de aceite
(`tools/asset-forge/baselines/neon-dusk.md`) ainda era orientado a um tipo
único (body-map) e não cobria o regime atmosférico nem o gate em lote.

## Decisão

1. **D1 — version 2 com regimes**: o bloco `style` vira
   `{ flat: {suffix, negative}, atmospheric: {suffix, negative} }`. O regime
   flat mantém o sufixo/negative atuais (proibições de texto, watermark, IP,
   nsfw, fundo claro, pedestal). O atmospheric deriva do flat trocando
   "glow neon" por "glow neon sobre o assunto, neon no primeiro plano" e
   adicionando "iluminação plana sem profundidade" — todas as demais
   proibições permanecem.
2. **D2 — 7 tipos**: metro-map é removido (o mapa do metrô é SVG hand-coded
   do app, sem arte IA) e avatar é substituído por portrait 512×768 (proporção
   de retrato de UI; o antigo 768×1024 não serve às views). Lista completa e
   famílias/distritos em bloco de código abaixo.
3. **D3 — regime por tipo e postprocess**: `type.regime` torna-se obrigatório
   ("flat" | "atmospheric") e `postprocess` passa a aceitar `{ rembg: true }`
   para body-map e item (recorte de silhueta na curadoria).
4. **D4 — seedFamilies**: 8 famílias nomeadas (cenas por distrito, retratos de
   despachantes e de origens, cromos, ampolas, itens de saque, backdrops,
   ilustrações de trampo) — seeds reprodutíveis e lote de curadoria por
   família.
5. **D5 — districts**: os 7 distritos entram como dado declarativo
   (`id`, `name`, `accent`, `prompt`). O acento funcional vira fonte única
   para o baseline (regime atmospheric) e para os prompts de cena.
6. **D6 — validação estrita**: o registry.mjs rejeita `version` ≠ 2, regime
   inválido, postprocess sem `rembg` booleano, seedFamilies/districts
   ausentes, ids duplicados e `family.type` inexistente.
7. **D7 — baseline por regime**: o gate de aceite é reestruturado — critérios
   noir-flat (body-map, item) e noir-atmosférico (scene, portrait, backdrop,
   ilustração de trampo), red flags por regime e gate em LOTE por família
   começando pelo asset âncora (body-map para flat; cena de Babilônia para o
   atmosférico).

```text
Tipos: body-map, icon, portrait, scene, item, backdrop, gig-art
Famílias: cenas-distritos, retratos-despachantes, retratos-origens, itens-cromo,
itens-ampolas, itens-loot, backdrops, ilustracoes-trampo
Distritos: babilonia, as-mortas, o-fervo, a-paraiso, o-fluxo, a-quebrada, o-ponto
```

## Consequências

- Positivo: fonte única de regimes, prompts, famílias e distritos no registry;
  validação de schema pega erro antes de gerar; o baseline cobre os 2 regimes
  e padroniza a curadoria por família (âncora primeiro, variantes, críticas,
  pós-processo, peso ≤ 250KB, nunca commitar "quase").
- Negativo: consumidores de `style.suffix`/`style.negative` diretos precisam
  migrar para `style[type.regime]`; metro-map e avatar deixam de existir como
  tipos (integrações futuras usam portrait e scene).
- Risco aceito: famílias e distritos são dados declarativos novos — se a
  curadoria revelar ajustes (família extra, acento recalibrado), basta editar
  o registry sem tocar código.