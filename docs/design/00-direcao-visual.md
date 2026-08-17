# 00 — Direção Visual

## Conceito central

> "Terminal sujo da quebrada tentando renderizar a cidade inteira."

A interface mistura: terminal corporativo velho, celular PWA de corredor, painel de metrô degradado, interface neural instável e linguagem de rua (cartaz, pichação, etiqueta).

## O que absorver das referências visuais

- Painéis com hierarquia clara.
- Barras grandes para progresso, HP, Humanidade, NIL e sucesso.
- Ações principais muito visíveis.
- Antes/depois explícito (ex.: custo de Humanidade vs. bônus recebido).
- Log de eventos com leitura rápida.
- Visual de rede/nós para hacking.
- Mapa corporal para instalação de cromo.
- Sensação de terminal, glitch e interface neural.

## O que NÃO copiar das referências

- Texto em inglês e caracteres sem sentido.
- Cidade neon genérica.
- Excesso de brilho e bloom.
- Botões gigantes sem contexto.
- Aparência de combate em tempo real.
- Watermarks (ex.: "DreaminaAI").
- Texto renderizado dentro da imagem.
- Tipografia pixelada para tudo.

## Diferenciais visuais de São Paulo 2087

| Elemento | Uso |
|---|---|
| Concreto e metal oxidado | Base dos painéis e fundos |
| Garoa ácida | Overlay ambiental em distritos baixos |
| Helicópteros e silhuetas verticais | Distritos corporativos |
| Neon em português | SAIDEIRA, TRAMPOS, CROMO, CORRE, BABILÔNIA |
| Vela de santo, arruda, terço, Exu/Ogum | Detalhes de vendors, Ferrageiros e eventos |
| Funk como território | Ondas/sub-bass no Fluxo e na Quebrada |
| Pastel, café, marmita | Itens de consumo e reforço cultural |
| Saturação por classe | Paraíso saturado; Quebrada quebrada; Mortas quase morta |
| Verticalidade | Progressão visual entre rua, meio e topo |

## Paleta de cores

Paleta canônica da marca (ver docs/definicoes-de-produto/01-visao-e-marca.md):

| Cor | HEX | Significado funcional |
|---|---|---|
| Background | #0a0a0a | Fundo principal |
| Surface | #161616 | Cards e painéis |
| Ação / Ciano | #f2f2f2 | Ação, navegação, dados do jogador (branco-luz) |
| Perigo / Magenta | #ff2020 | Perigo, perda, dano, hostilidade (vermelho sangue) |
| Grana / Gold | #d4a017 | Grana, recompensa, Moral, prestígio (âmbar muted) |
| Hacking / Purple | #8aa4b8 | Rede, hacking, trava, trace (aço azulado) |
| Text Primary | #e8e8e8 | Texto principal |
| Text Secondary | #9a9a9a | Texto secundário |
| Sucesso / Green | #c8c8c8 | Sucesso técnico, regeneração, estabilidade (cinza claro) |

Cinza dessaturado adicional para Quebrada e As Mortas (falta, decadência, tecnologia quebrada).

## Semântica de cor

- Ação = branco-luz. Perigo = vermelho sangue. Recompensa = âmbar muted. Hack = aço azulado. Sucesso = cinza claro.
- Os tokens legados (`nd-cyan`, `nd-magenta`, `nd-purple`, `nd-green`) foram mantidos como canais funcionais; uma refatoração futura pode renomeá-los para nomes semanticamente literais.
- Nunca usar cor como único canal de informação: sempre acompanhar de rótulo, ícone ou estado textual.
- Saturação varia por distrito (corporativo saturado, slum dessaturado).

## Tipografia

| Uso | Fonte |
|---|---|
| Headings | JetBrains Mono |
| Body | Inter |
| Dados | Fira Code |
| Terminal | Courier New / Fira Code |

Monospace apenas para títulos, números e dados. Narrativa sempre sans-serif.

## Princípios de UI

1. Tema escuro obrigatório.
2. Neon funcional (affordance), nunca decorativo.
3. HUD diegético: scanlines sutis opcionais, glitch em transições, bordas de terminal velho.
4. Mobile-first; grid 1 coluna no mobile, 2-3 no desktop.
5. Contraste validado para mobile; suporte a prefers-reduced-motion.
6. Toques alvo de pelo menos 44px em mobile.
