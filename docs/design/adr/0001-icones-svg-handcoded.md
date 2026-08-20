# ADR 0001 — Ícones P0 em SVG hand-coded

**Status**: aceito (registro de decisão; não reabrir)
**Data**: 2026-08-20
**Issue**: #137

## Contexto
O P0 exige 35 ícones de sistema legíveis a 24–32px sobre fundo canônico #0a0a0a, sem texto/glifos/watermark/IP, registrados no asset-manifest e aprovados no checklist de curadoria. Alternativas avaliadas: geração por IA (raster, risco de artefato/IP/texto), fonte de ícones (download extra, glifos, viola ADR §12 de design-tokens) e SVG hand-coded.

## Decisão
Ícones P0 serão SVG desenhados à mão (hand-coded), determinísticos e license-clean. Cada arquivo usa viewBox 0 0 24 24, stroke-only (fill="none"), stroke="currentColor", stroke-width 1.5, caps/joins round, coordenadas inteiras no grid 2–22, 1–3 elementos de forma (path/line/circle/rect/polyline). Cor do canal vive no manifest (colorToken), nunca hardcoded no SVG. Os 5 atributos são o molde de estilo antes de escalar. Confiança na decisão: 0.92.

## Consequências
- Positivo: controle total de legibilidade em 24px; licença limpa; herança de cor via currentColor; zero dependência nova; curadoria automatizável por teste determinístico.
- Negativo: esforço artesanal por ícone (35 no P0); sem efeitos ricos (gradientes/filtros vetados); curvas limitadas a L/A/Q/C para auditabilidade.
- Risco aceito: consistência visual depende da disciplina do style guide; mitigado pelo molde dos 5 atributos e pela preview page.
