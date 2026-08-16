# 00 — Direção Visual

## Conceito central

> "Terminal sujo da quebrada tentando renderizar a cidade inteira."

A interface mistura: terminal corporativo velho, celular PWA de edgerunner, painel de metrô degradado, interface neural instável e linguagem de rua (cartaz, pichação, etiqueta).

## O que absorver das referências visuais

- Painéis com hierarquia clara.
- Barras grandes para progresso, HP, Humanidade, NIL e sucesso.
- Ações principais muito visíveis.
- Antes/depois explícito (ex.: custo de Humanidade vs. bônus recebido).
- Log de eventos com leitura rápida.
- Visual de rede/nós para hacking.
- Mapa corporal para instalação de chrome.
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
| Neon em português | SAIDEIRA, GIGS, CHROME, CORRE, BABILÔNIA |
| Vela de santo, arruda, terço, Exu/Ogum | Detalhes de vendors, ripperdocs e eventos |
| Funk como território | Ondas/sub-bass no Fluxo e na Quebrada |
| Pastel, café, marmita | Itens de consumo e reforço cultural |
| Saturação por classe | Paraíso saturado; Quebrada quebrada; Mortas quase morta |
| Verticalidade | Progressão visual entre rua, meio e topo |

## Paleta de cores

Paleta canônica da marca (ver docs/definicoes-de-produto/01-visao-e-marca.md):

| Cor | HEX | Significado funcional |
|---|---|---|
| Background | #0a0a0f | Fundo principal |
| Surface | #12121a | Cards e painéis |
| Neon Cyan | #00f0ff | Ação, navegação, dados do jogador |
| Neon Magenta | #ff00aa | Perigo, perda, dano, hostilidade |
| Neon Gold | #ffcc00 | Eddies, recompensa, Street Cred, prestígio |
| Neon Purple | #aa00ff | Rede, hacking, ICE, trace |
| Text Primary | #e0e0e0 | Texto principal |
| Text Secondary | #888899 | Texto secundário |
| Glitch Green | #00ff66 | Sucesso técnico, regeneração, estabilidade |

Cinza dessaturado adicional para Quebrada e As Mortas (falta, decadência, tecnologia quebrada).

## Semântica de cor

- Ciano = ação. Magenta = perigo. Dourado = recompensa. Roxo = hack. Verde = sucesso.
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
