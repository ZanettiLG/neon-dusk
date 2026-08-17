# 04 — Pipeline de IA e Prompts

## Processo

1. Art bible: definir paleta, composição, estilo por categoria e proibições.
2. Prompt pack: template base + negative prompt.
3. Geração por lote na ordem de prioridade.
4. Curadoria com checklist.
5. Otimização (WebP/AVIF, tamanhos responsivos, lazy loading).
6. Registro no asset-manifest.json e integração na UI.

## Ordem de geração

1. Ícones e pictogramas.
2. Banners dos 7 distritos.
3. Retratos dos 8 despachantes.
4. Ampolas e itens de consumo.
5. Cromo por slot.
6. Drinks do Saideira.
7. Eventos e overlays.
8. Personagens e missões.

## Template base de prompt

```
Arte digital 2D, noir cyberpunk brasileiro, São Paulo 2087,
[assunto], [distrito], concreto, metal oxidado, garoa ácida,
neon em português, atmosfera densa, estilo consistente de UI game asset,
cores [paleta], composição [regra], iluminação [regra],
sem texto, sem letras, sem logotipos, sem marcas d'água
```

## Negative prompt padrão

```
texto, caracteres falsos, kanji, ideogramas, watermark, logo,
cidade neon genérica, cyber-samurai, excesso de bloom, anime genérico,
fotorrealismo corporativo, baixa legibilidade, anatomia quebrada,
referência direta a Cyberpunk 2077, Blade Runner ou qualquer IP existente
```

## Parâmetros por categoria

| Categoria | Formato | Composição | Notas |
|---|---|---|---|
| Ícones | 1:1 | Silhueta única centrada | Preferir SVG; raster apenas quando necessário |
| Retratos | 3:4 | Rosto e ombros, fundo distrital | Personagens com specs do lore |
| Banners de distrito | 16:9 | Vista ampla com ponto focal | Texto da UI sobreposto depois |
| Itens | 1:1 | Objeto único sobre fundo escuro | Reconhecível a 32px |
| Eventos | 16:9 | Cena dramática sem texto | Usado como overlay |

## Checklist de curadoria

- [ ] Sem texto ou glifos falsos.
- [ ] Sem watermark.
- [ ] Sem semelhança direta com IP existente.
- [ ] Reconhecível em tamanho pequeno.
- [ ] Funciona sobre fundo escuro.
- [ ] Não compromete contraste do texto.
- [ ] Combina com os demais assets da categoria.
- [ ] Nome, descrição, alt text e uso definidos no manifest.

## Otimização

- Exportar em WebP/AVIF.
- Criar tamanhos responsivos.
- Lazy loading para banners e retratos.
- Placeholder de baixa resolução.
- Ícones pequenos como SVG sempre que possível.
- Nenhuma imagem carrega texto essencial da interface.

## Limite legal e editorial

- Não usar nomes/termos de Cyberpunk 2077 ou do TTRPG (Kiroshi, MaxTac, Sandevistan, Mantis Blades, Gorilla Arms, Monowire, Trauma Team, Blackwall, Braindance, choom, edgerunner, Night City, Night City Legend, Johnny Silverhand) nem resíduos de lore em inglês (flatline, stim, syn-café, AdrenaStim, Cortex+, Black Lace, Glitter, Reflex, Ghost, ICE, Black ICE, ICEbreaker, Deep Net, Deep Dive, burnout, Blackout) no **produto inteiro** — docs, lore, copy, assets e prompts. A lista completa de termos banidos e a tabela de substituições oficiais estão em `../definicoes-de-produto/06-terminologia-e-ip.md`.
- Preferir marcas próprias: Grupo Falcão, Aço Paulista, Concreta, Instituto Paraíso, Rede Véu, Nó Cego — e os nomes oficiais de equipamento e serviços: Óptica Vidraça, SO Surto, SO Fúria, Braço de Ferro, Navalha, Arame, A Garra, Resgate, A Porteira, Sintonia, Saideira.
- Manter tom noir sujo documentado; sem apologia ao crime (risco BR documentado com The Crims).
