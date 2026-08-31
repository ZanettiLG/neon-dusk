# 05 — Design Tokens

Spec canônica dos design tokens do Neon Dusk. Fonte de verdade do código em
`app/src/lib/tokens.ts`, consumida pelo `app/tailwind.config.js` e pelos
componentes que renderizam barras de recurso.

## 1. Modelo de tokens

| Camada | Exemplo | Regra |
|---|---|---|
| Primitivo | `#f2f2f2` | Valor puro, sem semântica |
| Semântico | `nd-cyan` | Nome = significado funcional (ação, perigo, recompensa) |
| Componente | `neon-cyan`, `.btn-neon` | Agrupa tokens para um padrão de UI |

Regras de nomeação:

- **kebab-case**; chaves Tailwind com prefixo **`nd-`** (Neon Dusk) para cores,
  tipografia e durações; prefixo **`neon-`** para sombras.
- Nomes semânticos em português onde há significado (`nd-cyan` = ciano,
  `nd-dead-gray` = cinza morto, `nd-title-lg` = título grande).
- Nome descreve **função, não aparência**: `nd-dead-gray` (distritos mortos),
  nunca `nd-gray-3`.
- Cor nunca é o único canal de informação — todo estado colorido acompanha
  rótulo, ícone ou texto (regra de ouro nº 2 do design).

## 2. Cores

| Token | HEX | Semântica funcional | Uso típico |
|---|---|---|---|
| `nd-bg` | `#0a0a0a` | Fundo principal | Página, vazios de barra |
| `nd-surface` | `#161616` | Superfície elevada | Cards, painéis |
| `nd-cyan` | `#f2f2f2` | Ação, navegação, dados do jogador (branco-luz) | Botões, NIL cheio, links |
| `nd-magenta` | `#ff2020` | Perigo, perda, dano, hostilidade (vermelho sangue) | Alertas, NIL crítico, trampo difícil |
| `nd-gold` | `#d4a017` | Grana, recompensa, Moral, prestígio (âmbar muted) | Recompensas, LEGEND |
| `nd-purple` | `#8aa4b8` | Rede, hacking, trava, trace (aço azulado) | Despachantes, Vultos |
| `nd-text` | `#e8e8e8` | Texto principal | Títulos, valores |
| `nd-text-secondary` | `#9a9a9a` | Texto secundário | Rótulos, timestamps |
| `nd-green` | `#c8c8c8` | Sucesso técnico, regeneração, estabilidade (cinza claro) | HP cheio, trampo fácil |
| `nd-dead-gray` | `#3a3a3a` | Cinza dessaturado (falta, decadência) | Quebrada, As Mortas |

Sombras (hairline + drop, sem glow neon):

| Token | Valor |
|---|---|
| `neon-cyan` | `0 0 0 1px rgba(255,255,255,.06), 0 2px 8px rgba(0,0,0,.5)` |
| `neon-magenta` | `0 0 0 1px rgba(255,32,32,.25)` |
| `neon-gold` | `0 0 0 1px rgba(212,160,23,.25)` |
| `neon-purple` | `0 0 0 1px rgba(138,164,184,.25)` |
| `neon-green` | `0 0 0 1px rgba(200,200,200,.25)` |

## 3. Tipografia

Fontes: headings **JetBrains Mono**, body **Inter**, dados **Fira Code**,
terminal **Courier New / Fira Code**. Monospace só para títulos, números e
dados; narrativa sempre sans-serif.

Escala semântica (Tailwind: `[font-size, { lineHeight }]`):

| Token | px | rem | line-height | Uso |
|---|---|---|---|---|
| `nd-micro` | 10px | 0.625rem | 1.2 | Badges mínimos, hints de 10px |
| `nd-label` | 11px | 0.6875rem | 1.4 | Rótulos compactos |
| `nd-body-xs` | 12px | 0.75rem | 1.5 | Texto auxiliar, timestamps |
| `nd-body` | 14px | 0.875rem | 1.5 | Corpo padrão |
| `nd-body-lg` | 16px | 1rem | 1.6 | CTA grandes, parágrafos |
| `nd-title-xs` | 18px | 1.125rem | 1.3 | Títulos de card |
| `nd-title` | 24px | 1.5rem | 1.25 | Títulos de seção |
| `nd-title-lg` | 30px | 1.875rem | 1.2 | Títulos de página |

## 4. Espaçamento

Escala base-4 (Tailwind default) — tokens canônicos usados na UI:

| Chave | px | Uso |
|---|---|---|
| `1` | 4px | Gaps internos mínimos |
| `1.5` | 6px | Badges, chips |
| `2` | 8px | Padding de badges |
| `3` | 12px | Gaps de grid |
| `4` | 16px | Padding de card |
| `6` | 24px | Espaço entre seções |
| `8` | 32px | Margens de página |
| `12` | 48px | Seções maiores |

**Alvo de toque: mínimo 44px** em dispositivos de toque (WCAG 2.5.5) — ver
§9 do estilo: `.btn-neon` recebe `min-height: 44px` dentro de
`@media (pointer: coarse)`.

## 5. Raios

| Token | Valor | Uso |
|---|---|---|
| `terminal` | `2px` | Painéis, cards, botões, badges — borda de terminal velho |
| pill (`rounded-full`) | 9999px | Barras de progresso (NIL, dificuldade, Moral) |

## 6. Breakpoints (mobile-first)

| Token | Valor | Layout |
|---|---|---|
| `sm` | 640px | 2 colunas |
| `md` | 768px | Tablet |
| `lg` | 1024px | 3+ colunas |
| `xl` | 1280px | Desktop largo |

Base móvel: 320px. Grid: 1 col (mobile) → 2 (tablet) → 3 (desktop).

## 7. Durações de movimento

| Token | ms | Uso |
|---|---|---|
| `nd-fast` | 150ms | Hover de cor, micro-feedback |
| `nd-base` | 250ms | Transição padrão |
| `nd-slow` | 500ms | Preenchimento de barra, mudança de faixa |
| `nd-slower` | 2000ms | Pulso neon, respiração de HUD |

Animações (tokenizadas em `app/src/lib/tokens.ts` — `animation` + `keyframes`,
issue #53): `glitch` 0.2s, `flicker` 0.15s, `pulse-neon` 2s, `fade-in` 0.5s.

## 8. Thresholds de cor-por-faixa

Bandas cobrindo **todos os inteiros de 0–100** (cada inteiro em exatamente
uma banda), limites **inclusivos** (≥ min, ≤ max). Implementadas em
`RESOURCE_BAR_BANDS` / `bandFor` (`app/src/lib/tokens.ts`).

Faixas em terços (ordem crescente — primeira banda é a mais crítica):

| Recurso | 0–33 | 34–66 | 67–100 |
|---|---|---|---|
| `nil` | magenta (crítico) | gold (atenção) | cyan (estável) |
| `hp` | magenta (crítico) | gold (ferido) | green (estável) |

Dificuldade de trampo (invertida — baixa dificuldade é verde):

| Recurso | 0–39 | 40–59 | 60–100 |
|---|---|---|---|
| `gigDifficulty` | green (fácil) | gold (médio) | magenta (difícil) |

Humanidade — 5 bandas em ordem **decrescente** (derivada de
`definicoes-de-produto/04-sistemas-e-progressao.md` §4):

| Faixa | Label | Cor | Notas |
|---|---|---|---|
| 100–71 | Íntegro | `bg-nd-green` | |
| 70–41 | Instável | `bg-nd-gold` | |
| 40–21 | Borderline | `bg-nd-magenta` | |
| 20–1 | Cyberpsycho | `bg-nd-magenta` | `pulse: true` — flag de pulso |
| 0–0 | FLATLINE | `bg-nd-dead-gray` | estado textual, sem cor viva; label de código — pendente #145 |

Moral — "lenda" é exclusivo do score máximo:

| Faixa | Label | Cor |
|---|---|---|
| 0–99 | na rua | `bg-nd-cyan` |
| 100–100 | lenda | `bg-nd-gold` |

Campo `pulse?: boolean` (tipo `Band`): marca faixas cuja barra deve animar
(pulso) enquanto estiver naquela faixa — hoje apenas Cyberpsycho (20–1).
Consumidores podem compor `band.pulse` com `animate-pulse-neon`.

Comportamento de `bandFor` (contrato):
- Entrada esperada: **inteiro 0–100**. Frações são arredondadas para o
  inteiro mais próximo (`Math.round`) antes do lookup.
- Fora de faixa clampa: <0 → 0, >100 → 100.
- **NaN (ou qualquer não-finito) → primeira banda do array** — a mais
  crítica nas arrays ascendentes (nil, hp, gigDifficulty, streetCred); em
  `humanity` (decrescente) resolve para Íntegro (100–71). Ver §15.

Regra: toda faixa tem `label` (usado como `title`/texto quando a barra for
estendida) — cor nunca sozinha. "Cyberpsycho" e "FLATLINE" são labels de código (#145 — rename de labels pendente); em texto de produto o estado é
"Apagado" (04-sistemas-e-progressao.md §4).

## 9. Reduced motion

`prefers-reduced-motion: reduce` desliga movimento **decorativo**; feedback
de estado continua por cor e rótulo.

| Animação | Comportamento reduzido |
|---|---|
| `glitch` (títulos, transições) | Estático — sem transform |
| `flicker` (texto neon) | Opacidade 1 constante |
| `pulse-neon` (HUD) | Opacidade 1 constante |
| `transition-all` (hover de botão) | Instantâneo (0.01ms) |
| `active:scale-95` (botões) | Sem escala (vira instantâneo) |
| Scroll suave | `scroll-behavior: auto` |

Implementação: regra global em `@layer base` no `app/src/style.css` —
`animation-duration/iteration-count/transition-duration` → 0.01ms (instantâneo,
mas eventos de fim ainda disparam) com `!important`.

## 10. Spec de foco

Anel de foco canônico, aplicado globalmente via `:focus-visible`:

| Propriedade | Token | Valor |
|---|---|---|
| Cor | `--nd-focus-color` | `#f2f2f2` (canal nd-cyan / branco-luz) |
| Espessura | `--nd-focus-width` | 2px |
| Offset | `--nd-focus-offset` | 2px |

- Visível em **qualquer** fundo do tema (contraste branco-luz ≥ 17:1 sobre
  `nd-bg`, ≥ 14:1 sobre `nd-surface`).
- `outline-offset: 2px` impede o anel de encostar na borda do elemento.
- Nenhum componente remove o outline global sem substituição equivalente.

## 11. Auditoria de contraste (WCAG)

Razões contra `nd-bg` (#0a0a0a), texto normal AA = 4.5:1, AAA = 7:1,
texto grande/UI = 3:1:

| Cor | Razão | AA texto | AAA texto | Grande/UI |
|---|---|---|---|---|
| Branco-luz `#f2f2f2` | 17.7:1 | ✅ | ✅ | ✅ |
| Cinza claro `#c8c8c8` | 11.8:1 | ✅ | ✅ | ✅ |
| Âmbar muted `#d4a017` | 8.3:1 | ✅ | ✅ | ✅ |
| Vermelho sangue `#ff2020` | 5.1:1 | ✅ | ❌ | ✅ |
| Aço azulado `#8aa4b8` | 7.6:1 | ✅ | ✅ | ✅ |
| Texto `#e8e8e8` | 16.2:1 | ✅ | ✅ | ✅ |
| Texto secundário `#9a9a9a` | 7.0:1 | ✅ | ✅ | ✅ |

Consequências:

- **Aço azulado, cinza claro, âmbar muted e branco-luz são seguros para qualquer
  tamanho de texto.**
- Vermelho sangue passa AA mas não AAA — evitar parágrafos longos nessa cor.
- Texto secundário agora passa AA e AAA graças ao tom mais claro do noir.

## 12. ADR: WCAG AA como alvo; ícones SVG interno

**Contexto**: o jogo é PWA mobile-first com tema escuro saturado; contraste e
acessibilidade são requisitos de produto (docs/00 §5–6).

**Decisão**: alvo de acessibilidade **WCAG 2.2 AA**. Ícones renderizados como
**SVG inline** (stroke `currentColor`), nunca fonte de ícones nem imagens —
herdam a cor do texto, ganham o contraste do texto de graça e não dependem de
download de fonte.

**Consequências**:
- A nova paleta noir monocromática (issue #149) manteve os nomes de token
  legados (`nd-cyan`, `nd-magenta`, `nd-purple`, `nd-green`) como canais
  funcionais, mas trocou os valores para branco-luz, vermelho sangue,
  âmbar muted, aço azulado e cinza claro. As sombras deixaram o glow neon
  e passaram para hairline + drop shadow.
- Aço azulado e texto secundário agora passam AA (§11).
- 44px de alvo de toque em touch (§4).
- `prefers-reduced-motion` obrigatório em toda animação decorativa (§9).
- Rótulo/ícone sempre acompanham cor de estado (§1).

## 13. Riscos e casos de borda

1. **Import de TS na config do Tailwind**: `tailwind.config.js` importa
   `tokens.ts` via jiti (loader nativo do Tailwind 3.4) — confirmado
   funcionando; o fallback de HEX literais não foi necessário. Para o
   type-check do import dinâmico em `tokens.test.ts`, existe
   `app/tailwind.config.d.ts` (declaração mínima, sem `allowJs`).
2. **JIT e nomes de classe dinâmicos**: classes das bandas
   (`bg-nd-magenta` etc.) precisam existir como literais em arquivos
   escaneados (`content: ./src/**/*`). Elas vivem em `tokens.ts` (escaneado)
   — nunca construir classe por concatenação de strings em runtime.
3. **Clamp, arredondamento e NaN do percentual**: `bandFor` arredonda
   frações para o inteiro mais próximo e clampa `percent < 0 → 0` e
   `percent > 100 → 100`; bandas cobrem todos os inteiros 0–100
   (invariante, testada por varredura n=0..100). NaN/não-finito resolve
   para a primeira banda (determinístico — ver divergência D2, §15). O
   fallback para a última banda cobre violações futuras da invariante.
4. **Overrides de padding em botões**: views usam `px-3 py-1` em botões
   compactos; em touch o `min-height: 44px` (com `@media (pointer: coarse)`)
   garante o alvo mesmo assim. Elementos `inline-block` (ex.: `Link` com
   `btn-neon inline-block`) não centralizam conteúdo esticado pelo
   min-height — preferir `inline-flex` nesses usos (pendente em
   `SaideiraView.tsx`).
5. **Saturação por distrito** (planejado em docs/00): exigirá **variantes de
   token** (ex.: `nd-cyan-dead`), nunca HEX hardcoded em componentes.
6. **Reduced-motion não remove informação**: 0.01ms preserva eventos de fim
   de transição; estados continuam visíveis por cor + rótulo.
7. **Tema claro proibido**: tokens não têm par claro; darkMode `class`
   continua obrigatório (regra de ouro nº 1).

## 14. Implementação

| Artefato | Papel |
|---|---|
| `app/src/lib/tokens.ts` | Fonte única: `tokens` (raw, cores, fontes, raios, sombras, screens, durações, tipografia, z-index, touch, animações, efeitos) + `RESOURCE_BAR_BANDS` + `bandFor` |
| `app/src/lib/tokens-css.ts` | `buildTokensCss` — gera o bloco `:root { --nd-* }` a partir de `tokens` (issue #53) |
| `app/scripts/generate-tokens-css.mjs` | Gerador jiti — escreve `app/src/tokens.css` (falha com exit ≠ 0 em erro) |
| `app/src/tokens.css` | CSS gerado e **commitado** (PWA-first): vars `--nd-*`, foco derivado de `colors["nd-cyan"]` |
| `app/tailwind.config.js` | Importa `tokens` e mapeia para `theme.extend` |
| `app/tailwind.config.d.ts` | Declaração de tipos para o import dinâmico do config em `tokens.test.ts` |
| `app/src/style.css` | `@import "./tokens.css"`, reduced-motion global, `.btn-neon` 44px touch |
| `app/src/lib/tokens.test.ts` | Varredura 0–100 por recurso, clamps, NaN, frações, pulse, FLATLINE (label de código — pendente #145), pins das categorias, integração config |
| `app/src/lib/tokens-css.test.ts` | Pin byte-a-byte do `tokens.css` commitado (falha instrui `npm run tokens:generate`) |
| `app/src/lib/tokens-usage.test.ts` | Guard de consistência: classes nd-*/neon-* existem (fail), zero hardcode no core (fail), views warn-only, tokens sem uso → warn |
| Consumidores | `DashboardView` (NIL via `bandFor`), `GigCard` (dificuldade), `StreetCredDisplay` (fill via `tokens.colors`) |

## 15. Divergências registradas

Desvios intencionais entre spec original, produto e implementação:

1. **D1 — Alvo de toque 44px via `pointer: coarse`** (não breakpoint de
   viewport): WCAG 2.5.5 se refere à capacidade de toque do dispositivo;
   largura de tela não é proxy confiável. Desktop (mouse) fica intocado.
2. **D2 — NaN → primeira banda, não "mais crítica", em `humanity`**:
   `bandFor` é genérico e retorna a primeira banda do array para entrada
   não-finita. Nas arrays ascendentes a primeira banda é a mais crítica
   (nil/hp); `humanity` é decrescente por spec (04 §4), então NaN resolve
   para Íntegro (100–71). NaN é erro de chamador (contrato: inteiro 0–100);
   o comportamento é determinístico e testado — aceito como divergência
   documentada.
3. **D3 — FLATLINE com `bg-nd-dead-gray`** (label de código — pendente #145; a spec original dizia "sem cor,
   estado textual"): escolhido o token neutro `nd-dead-gray` (já na paleta)
   em vez de nenhuma cor — mantém a classe como literal (exigência do JIT,
   §13.2) e sinaliza o estado morto sem competir com as cores vivas; o label
   "FLATLINE" continua sendo o canal principal de informação (label de código — pendente #145).
4. **D4 — Moral em 2 bandas** (spec do pipeline: "ciano; Lenda (100)
   dourado"): implementado como 0–99 "na rua" (ciano) / 100 "lenda"
   (dourado). Consistente com a lógica LENDA existente em
   `StreetCredDisplay` (`nextThreshold === null` só no 100) e com
   `04-sistemas-e-progressao.md` §5 (Lenda = 100).
5. **D5 — `--nd-focus-color` duplica `tokens.colors["nd-cyan"]` (agora canal
   funcional `#f2f2f2`)**: CSS não importa TypeScript, então a única fonte
   programática não cobria CSS vars. **RESOLVIDO (issue #53)**: o gerador
   `app/scripts/generate-tokens-css.mjs` deriva `--nd-focus-color` de
   `colors["nd-cyan"]` em `buildTokensCss` (`app/src/lib/tokens-css.ts`) e
   escreve em `app/src/tokens.css` — a duplicação manual do `style.css` foi
   removida e o pin byte-a-byte (`tokens-css.test.ts`) garante sincronia.
6. **D6 — `duration-1000` → `duration-nd-slow` no ActiveGigPanel (fill do
   legwork)**: 1000ms virou 500ms — o fill da barra fica 2× mais rápido.
   Aceito porque §7 define o preenchimento de barra como `nd-slow` (500ms);
   o único consumidor da duração antiga era a barra de progresso do legwork.
7. **D7 — `shadow-[0_0_6px_rgba(255,204,0,0.15)]` → `shadow-neon-gold` no
   CharacterForm (atributo no soft cap)**: o glow amarelo (#ffcc00) virou o
   hairline gold do token (`0 0 0 1px rgba(212,160,23,.25)`) — glow banido
   pela direção visual (só hairline + drop, §2); o estado de soft cap segue
   sinalizado por `border-nd-gold/40` + `text-nd-gold`.
8. **D8 — `text-[9px]` → `text-nd-micro` no ChromeBodyMapSvg (badge CHEIO)**:
   9px virou 10px (piso da escala semântica §3 — não existe token abaixo de
   `nd-micro`). Delta de 1px no badge SVG, sem impacto de layout (posição
   fixa no viewBox); legibilidade ganha com o piso da escala.
