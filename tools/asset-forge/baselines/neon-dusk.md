# Baseline de estilo — Neon Dusk

Gate de aceite objetivo para assets gerados pelo asset-forge. Nenhum asset
entra no repo sem passar. Aplicado por humano (dev-time), não por código.

Direção visual canônica: noir sujo monocromático — **sem glow neon SOBRE O
ASSUNTO, sem bloom, sem anime genérico** (docs/design/00 §"O que NÃO copiar";
prompts em `../registry.json`). O regime atmosférico permite néon apenas como
luz ambiente ao fundo; o regime flat proíbe glow neon em qualquer posição.

## 1. Critérios objetivos por regime

Cada tipo pertence a um regime (`registry.json` → `type.regime`): **flat**
(body-map, item) ou **atmospheric** (scene, portrait, backdrop, gig-art).

### 1.1 noir-flat (body-map, item)

Assets de UI com silhueta recortável sobre fundo uniforme. O gate é avaliado
sobre o **asset final** (pós-processado), não sobre o PNG bruto da geração —
o modelo tende a produzir fundo claro/gradiente, corrigido na etapa de
pós-processamento (§4).

- **Fundo uniforme** `#0a0a0a` (garantido pela composição sobre `#0a0a0a`
  opaco), sem vazamento de cenário no assunto.
- **Luz plana** uniforme, sem sombras projetadas no fundo.
- **Silhueta recortável**: contorno legível do assunto, sem corte nas bordas.
- **Paleta noir**: monocromática, cinzas dessaturados, sem cor saturada
  dominante.
- **Sem texto/glifos**, **sem watermark**, **sem halo/fringe** claro na borda
  da figura (erode/feather no matte).
- **Peso ≤ 250KB** no asset final.
- **body-map**: anatomia coerente (2 braços, 2 pernas, 1 cabeça, proporções
  humanas plausíveis); pose neutra frontal, braços levemente afastados do
  tronco (as hit-areas do `/chrome` dependem disso), pernas neutras, cabeça
  ereta; corpo inteiro dentro do frame.
- **item**: objeto único isolado, sem cenário, reconhecível a 32px, sem
  detalhe microscópico.

### 1.2 noir-atmosférico (scene, portrait, backdrop, gig-art)

Assets de mundo com profundidade. O gate é avaliado sobre o **asset final**
(pós-processado, quando aplicável).

- **Luz volumétrica / chiaroscuro / profundidade atmosférica** — NUNCA luz
  plana chapada.
- **Um único acento funcional por distrito**: a cor do distrito vem de
  `registry.json` → `districts[].accent` (ex.: âmbar `#d4a017` de Babilônia);
  o resto permanece monocromático dessaturado.
- **Néon apenas como luz ambiente ao fundo** — NUNCA glow sobre o assunto.
- **Sem texto/glifos**, **sem watermark**.
- **Peso ≤ 250KB** no asset final.
- **scene**: vista ampla do distrito (arquitetura vertical, garoa), acento do
  distrito presente na composição; sem personagens em primeiro plano.
- **portrait**: rosto e ombros, fundo distrital desfocado, expressão neutra,
  anatomia facial plausível.
- **backdrop**: cenário amplo sem personagens.
- **gig-art**: cena de trampo com ação dramática, sem texto.

## 2. Red flags (reprova automática)

**Globais** (qualquer regime):

- Membros deformados, dedos extras, anatomia quebrada.
- Texto/letras/glifos ilegíveis na imagem.
- Anime genérico, cyber-samurai, estética de IP existente (Cyberpunk 2077,
  Blade Runner).
- Watermark, assinatura de modelo.

**noir-flat**:

- Fundo não-uniforme (vazamento de cenário no assunto).
- Glow neon, bloom excessivo.
- Luz não-plana (volumétrica/chiaroscuro em asset de UI).

**noir-atmosférico**:

- Glow neon sobre o assunto.
- Luz plana sem profundidade.
- Cor saturada dominante fora do acento funcional do distrito.
- Acento do distrito ausente ou errado (cenas de distrito).

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

O lote é curado **por família** (`registry.json` → `seedFamilies`), nunca
asset a asset solto.

1. **Asset âncora primeiro**: a primeira geração da família calibra o estilo e
   vira referência visual — body-map para o regime flat; a cena de Babilônia
   (`cenas-distritos` → `babilonia`) para o regime atmosférico.
2. Para cada asset da família: gerar N variantes (`generate <tipo>
   --variants N`, seeds da família) e criticar cada uma contra os critérios do
   regime (§1) + red flags (§2); escolher a melhor, rejeitar (deletar) as
   demais.
3. **Pós-processar** a escolhida quando `type.postprocess.rembg` (body-map,
   item): remoção de fundo com `rembg` (venv dev-only,
   `pip install "rembg[cpu]"`) → matte com erode ~2px + feather ~1px (mata
   halo/fringe) → composição sobre fundo `#0a0a0a` opaco.
4. Avaliar o **asset final** pós-processado contra os critérios — o gate de
   fundo uniforme vale para o asset final, não para o PNG bruto. Conferir
   **≤ 250KB**.
5. Renomear para o nome canônico (`output.filename` do registry, ou o id da
   família quando `filename` é null) e commitar.
6. Se nenhuma passar: ajustar prompt/seed e regerar. **Nunca commitar "quase"**.

## 5. Limites legais e editoriais

- Nenhum termo de IP banido em prompts ou assets — lista completa em
  `docs/definicoes-de-produto/06-terminologia-e-ip.md`; resumo em
  `docs/design/04-pipeline-ia-e-prompts.md` §Limite legal (o negative prompt do
  registry já carrega as proibições).
- Preferir marcas próprias do lore: Aço Paulista, Instituto Paraíso, Grupo
  Falcão, Concreta, Rede Véu, Nó Cego.
