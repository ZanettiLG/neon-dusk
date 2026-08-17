# 05 — Design Tokens

Spec canônica dos design tokens do Neon Dusk. Fonte de verdade do código em
`app/src/lib/tokens.ts`, consumida pelo `app/tailwind.config.js` e pelos
componentes que renderizam barras de recurso.

## 1. Modelo de tokens

| Camada | Exemplo | Regra |
|---|---|---|
| Primitivo | `#00f0ff` | Valor puro, sem semântica |
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
| `nd-bg` | `#0a0a0f` | Fundo principal | Página, vazios de barra |
| `nd-surface` | `#12121a` | Superfície elevada | Cards, painéis |
| `nd-cyan` | `#00f0ff` | Ação, navegação, dados do jogador | Botões, NIL cheio, links |
| `nd-magenta` | `#ff00aa` | Perigo, perda, dano, hostilidade | Alertas, NIL crítico, gig difícil |
| `nd-gold` | `#ffcc00` | Eddies, recompensa, Street Cred, prestígio | Recompensas, LEGEND |
| `nd-purple` | `#aa00ff` | Rede, hacking, ICE, trace | Fixers, netrun |
| `nd-text` | `#e0e0e0` | Texto principal | Títulos, valores |
| `nd-text-secondary` | `#888899` | Texto secundário | Rótulos, timestamps |
| `nd-green` | `#00ff66` | Sucesso técnico, regeneração, estabilidade | HP cheio, gig fácil |
| `nd-dead-gray` | `#3a3a45` | Cinza dessaturado (falta, decadência) | Quebrada, As Mortas |

Sombras neon (par: núcleo próximo + halo largo, alpha 0.3/0.1):

| Token | Valor |
|---|---|
| `neon-cyan` | `0 0 10px rgba(0,240,255,.3), 0 0 20px rgba(0,240,255,.1)` |
| `neon-magenta` | `0 0 10px rgba(255,0,170,.3), 0 0 20px rgba(255,0,170,.1)` |
| `neon-gold` | `0 0 10px rgba(255,204,0,.3), 0 0 20px rgba(255,204,0,.1)` |
| `neon-purple` | `0 0 10px rgba(170,0,255,.3), 0 0 20px rgba(170,0,255,.1)` |
| `neon-green` | `0 0 10px rgba(0,255,102,.3), 0 0 20px rgba(0,255,102,.1)` |

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
| pill (`rounded-full`) | 9999px | Barras de progresso (NIL, dificuldade, Street Cred) |

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

Animações existentes (não tokenizadas, mantidas no config):
`glitch` 0.2s, `flicker` 0.15s, `pulse-neon` 2s.

## 8. Thresholds de cor-por-faixa

Bandas cobrindo **todos os inteiros de 0–100** (cada inteiro em exatamente
uma banda), limites **inclusivos** (≥ min, ≤ max). Implementadas em
`RESOURCE_BAR_BANDS` / `bandFor` (`app/src/lib/tokens.ts`).

Faixas em terços (ordem crescente — primeira banda é a mais crítica):

| Recurso | 0–33 | 34–66 | 67–100 |
|---|---|---|---|
| `nil` | magenta (crítico) | gold (atenção) | cyan (estável) |
| `hp` | magenta (crítico) | gold (ferido) | green (estável) |

Dificuldade de gig (invertida — baixa dificuldade é verde):

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
| 0–0 | FLATLINE | `bg-nd-dead-gray` | estado textual, sem cor viva |

Street Cred — "lenda" é exclusivo do score máximo:

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
estendida) — cor nunca sozinha. "Cyberpsycho" e "FLATLINE" ficam em inglês
por serem termos canônicos do lore (assim como "LEGEND").

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
| Cor | `--nd-focus-color` | `#00f0ff` (nd-cyan) |
| Espessura | `--nd-focus-width` | 2px |
| Offset | `--nd-focus-offset` | 2px |

- Visível em **qualquer** fundo do tema (contraste ciano ≥ 14:1 sobre
  `nd-bg`, ≥ 12:1 sobre `nd-surface`).
- `outline-offset: 2px` impede o anel de encostar na borda do elemento.
- Nenhum componente remove o outline global sem substituição equivalente.

## 11. Auditoria de contraste (WCAG)

Razões contra `nd-bg` (#0a0a0f), texto normal AA = 4.5:1, AAA = 7:1,
texto grande/UI = 3:1:

| Cor | Razão | AA texto | AAA texto | Grande/UI |
|---|---|---|---|---|
| Ciano `#00f0ff` | 14.0:1 | ✅ | ✅ | ✅ |
| Verde `#00ff66` | 14.6:1 | ✅ | ✅ | ✅ |
| Dourado `#ffcc00` | 13.1:1 | ✅ | ✅ | ✅ |
| Magenta `#ff00aa` | 5.5:1 | ✅ | ❌ | ✅ |
| Roxo `#aa00ff` | 3.9:1 | ❌ **FALHA** | ❌ | ✅ |
| Texto `#e0e0e0` | 14.1:1 | ✅ | ✅ | ✅ |
| Texto secundário `#888899` | 5.7:1 | ✅ | ❌ | ✅ |

Consequências:

- **Roxo só para texto grande (≥ 18px/14px bold), bordas e acentos de UI** —
  nunca corpo de texto pequeno. Hoje usado em links de navegação com texto
  ≥ 12px bold uppercase + borda; auditar quando houver roxo em corpo.
- Magenta e texto secundário passam AA mas não AAA — evitar parágrafos longos
  nessas cores.
- Ciano, verde e dourado são seguros para qualquer tamanho.

## 12. ADR: WCAG AA como alvo; ícones SVG interno

**Contexto**: o jogo é PWA mobile-first com tema escuro saturado; contraste e
acessibilidade são requisitos de produto (docs/00 §5–6).

**Decisão**: alvo de acessibilidade **WCAG 2.2 AA**. Ícones renderizados como
**SVG inline** (stroke `currentColor`), nunca fonte de ícones nem imagens —
herdam a cor do texto, ganham o contraste do texto de graça e não dependem de
download de fonte.

**Consequências**:
- Roxo restrito a texto grande/UI (falha AA em texto normal, §11).
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
| `app/src/lib/tokens.ts` | Fonte única: `tokens` (cores, raios, sombras, screens, durações, tipografia) + `RESOURCE_BAR_BANDS` + `bandFor` |
| `app/tailwind.config.js` | Importa `tokens` e mapeia para `theme.extend` |
| `app/tailwind.config.d.ts` | Declaração de tipos para o import dinâmico do config em `tokens.test.ts` |
| `app/src/style.css` | Tokens de foco (CSS vars), reduced-motion global, `.btn-neon` 44px touch |
| `app/src/lib/tokens.test.ts` | Varredura 0–100 por recurso, clamps, NaN, frações, pulse, FLATLINE, integração config |
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
3. **D3 — FLATLINE com `bg-nd-dead-gray`** (a spec original dizia "sem cor,
   estado textual"): escolhido o token neutro `nd-dead-gray` (já na paleta)
   em vez de nenhuma cor — mantém a classe como literal (exigência do JIT,
   §13.2) e sinaliza o estado morto sem competir com as cores vivas; o label
   "FLATLINE" continua sendo o canal principal de informação.
4. **D4 — Street Cred em 2 bandas** (spec do pipeline: "ciano; Legend (100)
   dourado"): implementado como 0–99 "na rua" (ciano) / 100 "lenda"
   (dourado). Consistente com a lógica LEGEND existente em
   `StreetCredDisplay` (`nextThreshold === null` só no 100) e com
   `04-sistemas-e-progressao.md` §5 (Legend = 100).
5. **D5 — `--nd-focus-color` duplica `tokens.colors["nd-cyan"]`**: CSS não
   importa TypeScript, então a única fonte programática não cobre CSS vars.
   Mitigação: comentário `ponytail` no `style.css` exige atualizar os dois
   arquivos se a cor mudar.
