# Visão e Marca

## Nome: Neon Dusk

**Neon Dusk** evoca o momento em que as luzes da cidade acendem contra o céu que escurece — a hora em que os corredores saem às ruas, os despachantes atendem chamadas e o submundo desperta. É o crepúsculo neon: belo e letal.

**Formas de uso**:
- Título: **Neon Dusk**
- Estilizado: **NEON//DUSK** (para uso em UI, logo, headers)
- Domínio alvo: `neondusk.com` ou `neondusk.io`

### Por que este nome?

| Critério | Avaliação |
|---|---|
| Evoca o gênero | "Neon" é o significante visual mais forte do cyberpunk |
| Tom correto | "Dusk" sugere o limiar — nem dia corporativo, nem noite total. O espaço do corredor |
| Memorável | Duas sílabas, contraste semântico (luz × escuridão) |
| Domain-friendly | Curto, sem hífens, fácil de soletrar |
| Não infringe IP | Cyberpunk 2077 é uma marca da CDPR; "Neon Dusk" não usa termos proprietários |

---

## Tagline

> **"Build your cromo. Burn your name. Leave a legend."**

Variações:
- Curta (UI): *"Build cromo. Burn bright."*
- Steam/loja: *"In the neon dusk, legends aren't born — they're installed."*

---

## Tom e Voz

### Personalidade da Marca

| Dimensão | Descrição |
|---|---|
| **Atitude** | Noir sujo, irônico, sem glamourizar a violência |
| **Humor** | Seco, cínico, estilo Gibson — "The sky above the port was the color of television, tuned to a dead channel" |
| **Respeito ao jogador** | Não trata o jogador como herói. Trata como sobrevivente. "Você não vai salvar o mundo. Talvez salve a si mesmo. Talvez." |
| **Tom dos textos** | Frases curtas. Verbos no imperativo. Sem exposição desnecessária. "O despachante pagou. Você entregou. Ninguém morreu. Hoje foi um bom dia." |

### O Que NÃO Somos
- Não somos heróicos ("save the world")
- Não somos infantis (sem humor pastelão)
- Não somos pornográficos (a violência é suja, não gratuita)
- Não somos corporativos (a UI pode ser limpa, mas a voz nunca é)

### Referências de Tom
- **Neuromancer** (Gibson): prosa cinética, descrições sensoriais, jargão que o leitor infere
- **Blade Runner**: melancolia existencial, beleza na decadência

### Elogios de Rua

O feedback de resultado segue o **Catálogo de Elogios de Rua** — strings canônicas aprovadas ("Serviço limpo.", "Deu ruim."), nunca elogios traduzidos ("good job"). Catálogo completo e regra de tom em [06-terminologia-e-ip.md](./06-terminologia-e-ip.md).

---

## Identidade Visual

### Paleta de Cores

| Cor | HEX | Uso |
|---|---|---|
| **Background** | `#0a0a0a` | Fundo principal (nunca preto puro) |
| **Surface** | `#161616` | Cards, painéis, superfícies elevadas |
| **Ação / Ciano** | `#f2f2f2` | Ações primárias, links, dados críticos (branco-luz) |
| **Perigo / Magenta** | `#ff2020` | Alertas, dano, perigo, inimigos (vermelho sangue) |
| **Grana / Gold** | `#d4a017` | Grana, recompensas, loot, sucesso (âmbar muted) |
| **Hacking / Purple** | `#8aa4b8` | Hacking, Rede, Netrun (aço azulado) |
| **Text Primary** | `#e8e8e8` | Texto principal |
| **Text Secondary** | `#9a9a9a` | Texto secundário, descrições |
| **Sucesso / Green** | `#c8c8c8` | Terminal, dados técnicos, sucesso de hack (cinza claro) |

### Tipografia

| Uso | Fonte | Fallback |
|---|---|---|
| **Headings** | `Share Tech Mono` ou `JetBrains Mono` | monospace |
| **Body** | `Inter` ou `IBM Plex Sans` | sans-serif |
| **Dados** | `Fira Code` ou `Source Code Pro` | monospace |
| **Terminal** | `Courier New` ou `Fira Code` | monospace |

### Princípios de UI

1. **Tema escuro OBRIGATÓRIO** — nunca há modo claro. A tela é um terminal sujo.
2. **Neon funcional / noir monocromático** — cor = affordance, não decoração. Os nomes de token legados (`nd-cyan`, `nd-magenta`, `nd-purple`, `nd-green`) agora funcionam como canais semânticos (ação, perigo, hack, sucesso), não como descrições literais de cor. Ciano vira branco-luz, magenta vira vermelho sangue, dourado vira âmbar muted, roxo vira aço azulado, verde vira cinza claro.
3. **Saturação = classe** — distritos corporativos têm neon mais saturado; slums são dessaturados, quebrados.
4. **HUD diegético** — scanlines sutis (opcionais), glitch ocasional em transições, bordas que lembram terminais velhos.
5. **Tipografia monospace para dados** — stats, números, valores são monospace. Narrativa é sans-serif.
6. **Layout responsivo** — mobile-first (PWA), mas expansível para desktop. Grid de 1 coluna no mobile, 2-3 colunas no desktop.

### Logo Conceitual

```
╔══════════════════════════╗
║  N E O N / / D U S K    ║
║  ─────────────────────  ║
║  build cromo.          ║
║  burn bright.           ║
╚══════════════════════════╝
```

Glitch alternativo: `N̷E̷O̷N̷/̷/̷D̷U̷S̷K̷` com efeito de scanline e flicker de neon.

---

## Posicionamento

### Para quem é este jogo?

| Perfil | Descrição |
|---|---|
| **Público primário** | Homens e mulheres, 18-35, fãs de cyberpunk, RPG, ficção científica. Jogadores casuais que buscam profundidade sem grind infinito. |
| **Público secundário** | Veteranos de PBBG (The Crims, Torn) buscando uma experiência nova. Fãs de Cyberpunk 2077 que querem mais do universo. |
| **Não é para** | Jogadores que buscam ação em tempo real, gráficos 3D, ou experiências single-player narrativas. |

### Por que este jogo existe?

O gênero PBBG tem sobreviventes de 20+ anos (Torn, Hattrick, Kingdom of Loathing) mas **nenhum** jogo consolidado no gênero cyberpunk com:
1. Mecânicas de cromo/humanidade como trade-off real (não apenas cosmético)
2. Sistema de Lendas com prestígio permanente (estilo KoL Ascensão)
3. Hacking integrado como segunda camada de gameplay (não minigame separado)
4. Tom adulto e autêntico ao gênero (não pasteurizado para mobile)

**Neon Dusk** preenche esta lacuna.
