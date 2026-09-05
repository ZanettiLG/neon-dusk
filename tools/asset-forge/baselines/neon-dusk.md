# Baseline de estilo — Neon Dusk

Gate de aceite objetivo para assets gerados pelo asset-forge. Nenhum asset
entra no repo sem passar. Aplicado por humano (dev-time), não por código.

Direção visual canônica: noir sujo monocromático — **sem glow neon, sem bloom,
sem anime genérico** (docs/design/00 §"O que NÃO copiar"; prompts em
`../registry.json`).

## 1. Critérios objetivos por tipo

### body-map (integrado nesta issue)

- **Anatomia coerente**: 2 braços, 2 pernas, 1 cabeça, proporções humanas
  plausíveis.
- **Silhueta legível**: corpo inteiro visível, sem corte nas bordas, fundo
  uniforme `#0a0a0a`.
- **Pose neutra**: frontal, braços levemente afastados do tronco (as hit-areas
  do `/chrome` dependem disso), pernas juntas, cabeça ereta.
- **Paleta noir**: monocromática, cinzas dessaturados, sem cor saturada
  dominante.
- **Sem texto/glifos** na imagem.
- **Sem watermark**.

### metro-map / icon / avatar (geração sob demanda)

Critérios resumidos — detalhar quando forem integrados:

- **metro-map**: diagrama limpo, linhas retas + estações circulares, fundo
  escuro uniforme, sem texto.
- **icon**: silhueta única centrada, reconhecível a 24px, sem detalhe
  microscópico.
- **avatar**: retrato de rosto e ombros, fundo distrital coerente com o lore,
  anatomia facial plausível.

## 2. Red flags (reprova automática)

- Membros deformados, dedos extras, anatomia quebrada.
- Texto/letras/glifos ilegíveis na imagem.
- Glow neon, bloom excessivo.
- Anime genérico, cyber-samurai, estética de IP existente (Cyberpunk 2077,
  Blade Runner).
- Fundo não-uniforme (vazamento de cenário no corpo).
- Watermark, assinatura de modelo.

## 3. Paleta hex canônica

Fonte: `docs/design/05-design-tokens.md` §2. O asset deve conviver com esta
paleta (fundo/realces), nunca introduzir cor fora dela.

| Hex       | Uso                   |
| --------- | --------------------- |
| `#0a0a0a` | fundo                 |
| `#161616` | surface               |
| `#f2f2f2` | ação / branco-luz     |
| `#ff2020` | perigo                |
| `#d4a017` | grana / âmbar         |
| `#8aa4b8` | rede / aço azulado    |
| `#e8e8e8` | texto                 |
| `#9a9a9a` | texto secundário      |
| `#c8c8c8` | sucesso / cinza claro |
| `#3a3a3a` | cinza morto           |

## 4. Gate de aceite

1. Gerar N variantes (`generate <tipo> --variants N`).
2. Criticar cada uma contra os critérios (§1) + red flags (§2).
3. Escolher a melhor; rejeitar (deletar) as demais.
4. Renomear para o nome canônico (`output.filename` do registry) e commitar.
5. Se nenhuma passar: ajustar prompt/seed e regerar. **Nunca commitar "quase"**.

## 5. Limites legais e editoriais

- Nenhum termo de IP banido em prompts ou assets — lista completa em
  `docs/definicoes-de-produto/06-terminologia-e-ip.md`; resumo em
  `docs/design/04-pipeline-ia-e-prompts.md` §Limite legal (o negative prompt do
  registry já carrega as proibições).
- Preferir marcas próprias do lore: Aço Paulista, Instituto Paraíso, Grupo
  Falcão, Concreta, Rede Véu, Nó Cego.
