# Sistemas e Progressão

## 0. Criação de Personagem

### 0.1 Conta

- Registro com **email válido** e **senha forte** (8–72 caracteres, ≥1 maiúscula, ≥1 dígito).
- Login retorna **erro genérico** para email inexistente ou senha errada (anti-enumeração de contas).
- Autenticação via **JWT**: access token (curto) + refresh token (rotativo, revogável).
- Email e codinome são **únicos case-insensitive**.

### 0.2 Personagem

- **1 personagem por usuário por rodada** (1:1 durante a rodada; reseta a cada rodada).
- **Codinome**: 2–24 caracteres, único.
- **Origem**: 1 de 7 distritos de São Paulo.
- **Banca**: 1 de 5 (Socorrista é Fase 2).

### 0.3 Atributos na Criação

- Escala de vida: 1–20.
- Na criação: **3 de base em cada atributo + 7 pontos livres = 22**.
- **Floor de criação: 3** — nenhum atributo pode ficar abaixo da base.
- **Teto de criação: 10** — com 7 pontos livres, o máximo alcançável em um único atributo é 10.
- Soft cap (15) e cap (20) são **inalcançáveis na criação** — só via progressão.

### 0.4 Banca e Frase

| Banca | Frase |
|---|---|
| **Bicho** | *"Você não precisa ser mais rápido que a bala. Só mais rápido que o alvo."* |
| **Vulto** | *"A fechadura mais forte do mundo não serve de nada se a porta é o cérebro do guarda."* |
| **Gambiarrista** | *"Toda máquina tem um ponto fraco. Eu encontro. Você explode."* |
| **Despachante** | *"Não importa o que você sabe. Importa quem você conhece. E eu conheço todo mundo."* |
| **Estradeiro** | *"A estrada não tem dono. Só tem quem passa primeiro."* |

> **Nota**: Socorrista é Fase 2.

### 0.5 Origem → Avatar

- Avatar derivado da origem de forma **determinística client-side** (glifo + cor de destaque por distrito).
- Retratos ilustrados são **fase posterior**.

---

## 1. Atributos

Baseado no sistema Cyberpunk RED (10 atributos), simplificado para 5 atributos com escala 1-20.

### Os 5 Atributos

| Atributo | Símbolo | Descrição | Afeta | Classe Primária |
|---|---|---|---|---|
| **Body** | BOD | Força física, resistência, tolerância a dor e cromo | Dano corpo a corpo, HP, capacidade de cromo físico | Bicho |
| **Reflexes** | REF | Velocidade, coordenação, reflexos de combate | Chance de crítico, esquiva, velocidade de trampo | Bicho, Estradeiro |
| **Intelligence** | INT | Capacidade cognitiva, hacking, análise | RAM de hacking, sucesso em Netrun, learn rate | Vulto |
| **Technical** | TEC | Habilidade técnica, engenharia, crafting | Eficiência de crafting, upgrades de cromo, lockpicking | Gambiarrista |
| **Cool** | COL | Autocontrole, presença, manipulação social, resistência a stress | Sucesso social, Moral ganha, resistência a cyberpsychosis | Despachante |

### Progressão

- Começa com 3 pontos em cada atributo + 7 pontos livres
- **+1 ponto de atributo por nível** (max 50 níveis na rodada)
- Cap por atributo: 20
- **Soft cap**: após 15, custo dobra (2 pontos de atributo para subir 1)

#### Fontes de XP (resolve #183)

XP é **faucet de atividade**: só entra por ações no jogo — Créditos (₵) NUNCA compram XP (alinhado a "conveniência nunca poder", 05-roadmap §Monetização). XP é por personagem e zera na rodada.

| Fonte | XP | Nota |
|---|---|---|
| Trampo T1 (Bico) | 20 | Sucesso. Falha = 30% (arredondado para baixo) |
| Trampo T2 (Corre) | 35 | Sucesso. Falha = 30% |
| Trampo T3 (Esquema) | 60 | Sucesso. Falha = 30% |
| Trampo T4 (Golpe) | 100 | Sucesso. Falha = 30% |
| Trampo T5 (Golpe Mestre) | 160 | Sucesso. Falha = 30% |
| Legwork concluído | 5 | Incentiva a fase 2 do loop (03 §2) |
| PvP — vitória | 40 | Contam só as 3 primeiras vitórias/dia (anti-grind, espelha o teto de derrotas) |
| PvP — derrota | 10 | Contam só as 3 primeiras derrotas/dia |
| Hacking — camada de trava | 15 | Por camada superada (subnet 1-5 camadas) |
| Hacking — subnet corporativa completa | +10 | Bônus de conclusão |
| Missão diária | 50 | Fase 2 (05-roadmap), valor definido agora |
| Rolê — boca | 30 | Por boca invadida (rolê de gangue — issue #96) |
| Rolê — cabeça | 80 | Por cabeça derrubada |
| **Teto diário de XP** | **800 XP/dia** | Anti-grind: NIL já limita, mas o teto protege contra boosters de NIL premium (₵) acelerarem XP |

O teto diário fica **acima** do ritmo ativo (~650-730 XP/dia) e **abaixo** do que boosters permitiriam (~1.200+/dia) — ninguém legítimo encosta no teto; quem paga não ultrapassa o ativo.

#### Curva de XP

**`XP(n) = 50 + 5 × (n − 1)`** — XP necessário para subir do nível `n` para `n+1` (n = nível atual, 1-49).

| Nível | XP p/ subir | XP acumulado |
|---|---|---|
| 1→2 | 50 | 50 |
| 5→6 | 70 | 230 |
| 10→11 | 95 | 630 |
| 15→16 | 120 | 1.155 |
| 20→21 | 145 | 1.805 |
| 25→26 | 170 | 2.580 |
| 30→31 | 195 | 3.480 |
| 40→41 | 245 | 5.655 |
| 49→50 | 290 | **8.330** |

Curva levemente crescente (50→290, ~5,8× de crescimento): níveis iniciais rápidos (progressão perceptível nas primeiras 24h), fim de rodada com peso (anti-grind natural, retenção D7-D14). O jogador ativo chega ao cap (~8.330 XP, nível 50) no dia 13-14; o casual termina a rodada em ~nível 26.

#### Gasto de Pontos

- **Distribuição manual**: cada nível dá **1 ponto de atributo**. O jogador escolhe onde gastar — é o núcleo de build do RPG. Sem auto-distribuição.
- **Custo**: 1 ponto = +1 atributo até 15. Acima de 15 (soft cap), **2 pontos = +1**.
- **Cap**: 20 por atributo.
- **Orçamento da rodada**: 7 pontos de criação (teto 10/atributo na criação) + 49 pontos de nível (níveis 1→50) = **56 pontos**. Máximo num atributo: 3→15 (12 pts) + 15→20 (10 pts) = 22 pts — ninguém maxa tudo; build é escolha.
- **Pontos não gastos** persistem até o fim da rodada (banco de pontos), mas **somem no reset**.

#### Gates de Nível

| Gate | Sistema |
|---|---|
| **Nível → tier de equipamento** | T1=1, T2=5, T3=15, T4=30, T5=50 (espelha a tabela de cromo e a Universidade). Detalhe em §6.1 |
| **Nível → cromo** | Já existe (§3: T1=1, T2=5, T3=15, T4=30, T5=50) |
| **Nível → Universidade** | Já existe (issue #95: 5/15/30) |
| **Nível → conteúdo** | **NÃO**. Conteúdo (trampos, despachantes, distritos, bondes) é gateado por **Moral** (§5) — Moral é o score social da rodada; nível é poder individual. Separar os dois evita duplo gate e mantém o jogador social e o jogador de poder em trilhas distintas |

#### Reset de Nível

- **Reset (§7)**: nível zera para 1, XP zera, pontos não gastos somem, atributos voltam para **3×5 = 15**.
- **Universidade T3 (issue #95)**: o **+1 atributo base permanente sobrevive** — é prestígio, aplicado por cima da base 3. Rodada nova começa com `3 + bônus_permanente`. O bônus da rodada (T1+T2+T3 = +3 na área) **não** sobrevive.
- **Hall de Lendas (§7)**: o **+1 ponto de atributo livre permanente** (Completionist) também sobrevive e soma ao orçamento de criação da próxima rodada. Máximo combinado: +6 de Universidade (uma por rodada) + 1 do Completionist.

---

## 1.1 Stats Derivados (resolve #184)

A ponte atributos → ações: os 5 atributos (§1) não alimentam ações diretamente — alimentam **11 stats derivados**, e as ações consomem stats derivados. Interliga: #183 (nível → pontos → atributos alimentam estes stats), #185 (equipamento modifica estes stats), #186 (combate consome estes stats), #89 (abordagens de trampo), #96 (rolê usa Poder de Combate).

### Os 11 Stats Derivados

| # | Stat | Símbolo | Função |
|---|---|---|---|
| 1 | Ataque Físico | ATQ | Acerto e dano em combate; abordagem Assault |
| 2 | Defesa | DEF | Mitigação de dano; resistência física |
| 3 | Iniciativa | INI | Quem bate primeiro; fuga; emboscada |
| 4 | Esquiva | ESQ | Chance de desviar; fuga; abordagem Stealth |
| 5 | Precisão | PRE | Chance de acerto e de crítico |
| 6 | HP máx | HP | Pontos de vida |
| 7 | Poder de Hack | PHK | Força de ataque na Rede; abordagem Netrun |
| 8 | RAM | RAM | Recurso de hacking (gasta por ação) |
| 9 | Furtividade | FUR | Não ser visto; emboscada; abordagem Stealth |
| 10 | Influência | INF | Social, negociação, desconto em vendors |
| 11 | Resistência Mental | RME | Salvar contra cyberpsychosis; resistir a trace |

### Fórmulas (inteiras, determinísticas)

Todas usam `floor`/`ceil` — **nunca float**. Bônus de cromo = soma dos campos de bônus do cromo (§3). Bônus de equipamento = itens equipados (§6.1). Bônus de banca = passivos de banca (§2).

| Stat | Fórmula | Faixa típica |
|---|---|---|
| **ATQ** | `BOD + REF + cromo + arma` | 6-58 |
| **DEF** | `BOD + TEC + cromo + proteção` | 6-60 |
| **INI** | `REF + cromo + acessório` | 3-28 |
| **ESQ** | `REF + cromo + roupa` | 3-31 |
| **PRE** | `REF + INT + cromo + arma` | 6-53 |
| **HP** | `50 + BOD×5 + cromo + proteção` | 65-210 |
| **PHK** | `INT + TEC + cromo + acessório` | 6-48 |
| **RAM** | `INT×2 + cromo + SO Gazuá (+40%)` | 6-56 |
| **FUR** | `INT + COL + cromo + roupa` | 6-72 |
| **INF** | `COL + floor(Moral/10) + cromo + roupa` | 3-36 |
| **RME** | `COL + floor(Humanidade/10) + cromo` | 3-35 |

**Pontes**: `floor(Humanidade/10)` → RME — Humanidade 100 → +10 RME; Humanidade 20 (Cyberpsycho) → +2 (quanto mais perto do apagão, mais frágil a mente). `floor(Moral/10)` → INF — Moral 100 → +10 INF (reputação abre porta, 02 §Saideira).

### Atributo → Stats

| Atributo | Alimenta | Peso |
|---|---|---|
| **BOD** | ATQ, DEF, HP | Força bruta |
| **REF** | ATQ, INI, ESQ, PRE | Velocidade — o atributo mais "combate" |
| **INT** | PRE, PHK, RAM, FUR | Mente — hacking + furtividade calculada |
| **TEC** | DEF, PHK | Engenharia — defesa + hack |
| **COL** | FUR, INF, RME | Presença — social + resistência |

Nenhum atributo é morto: cada um alimenta 2-4 stats. BOD/REF dominam combate, INT/TEC dominam hacking, COL domina social — as 5 bancas (§2) têm trilhas naturais.

### Modificadores de Contexto

Aplicam como multiplicador na rolagem final. Ordem de aplicação: contexto → fase → consumível. **Sem** modificador de hora do dia e **sem** penalidade de furtividade por cromo — realismo serve a jogatina; cromo é progressão central e não pode punir builds.

| Modificador | Escopo | Valor | Quando |
|---|---|---|---|
| **Perigo do distrito** | Trampo execute/escape, rolê | Babilônia 1,00 · A Quebrada 1,00 · O Fervo 0,95 · O Fluxo 0,95 · A Paraíso 0,90 · As Mortas 0,85 · O Ponto 0,75 | Sempre, pelo distrito da ação |
| **Heat por gangue** | Rolê e trampos no território da gangue | heat 0-49: 1,00 · heat 50-99: 0,85 · heat 100+: 0,70 | Heat acumulada (rolê de gangue — issue #96) |
| **Reputação de facção** | Trampos/vendors no distrito da facção | Amiga +10% (1,10) · Hostil −10% (0,90) | Sistema #88 (Fase 3) — hooks stub no v1 |
| **Dia da rodada** | Rolê de gangue | 1,0× → 2,2× (tabela de rolê de gangue reutilizada — issue #96) | Aplica **só** a conteúdo de gangue — trampos de despachante não escalam com o dia |

Faixa total: **−30%** (O Ponto + heat 100) a **+10%** (rep amiga + dia).

### Consumo por Sistema

| Sistema | Consumo |
|---|---|
| **Trampo — Stealth** (#89) | Execute usa **FUR**, escape usa **ESQ**. Consequência: heat −50% em falha |
| **Trampo — Assault** (#89) | Execute usa **ATQ**, escape usa **ESQ**. Consome 1 munição (§6.1) |
| **Trampo — Netrun** (#89) | Execute usa **PHK**, escape usa **ESQ**. Gate: requer SO Gazuá/hacking (§3) |
| **Trampo — fórmula** | `chance = clamp((stat_derivado × 5 + bônus_cromo) / (dificuldade × 2), 0,05, 0,95)` — **STAT_SCALING_DERIVADO = 2,5** (equivalente a ×5/×2 inteiro; `bônus_cromo` no numerador). Preserva a tabela de dificuldade 1-100 e a calibração atual |
| **PvP** | 1 rolagem contestada (#186): ATQ vs DEF, ESQ esquiva, PRE crítico, HP dano; INI/ESQ/FUR em fuga e emboscada (03 §3) |
| **Hacking** | PHK vs camadas de trava; RAM é o recurso (gasta por ação, recarrega 1/60s — 03 §4); RME reduz trace: `trace_gerado × (1 − RME/100)` |
| **Rolê de gangue** (#96) | **Poder de Combate** (fallback simplificado, sem trocas): `floor((ATQ + DEF + floor(HP/10)) / 3) + random(1..10)` — normalizado para a escala antiga; bocas 12-44 continuam válidas sem recalibração |
| **Social/despachantes** | INF em trampos de Negotiation (03 §2), desconto em vendors (INF 20+ → +5%, acumula com Moral), opções de diálogo. RME resiste a manipulação |

### Transparência Métrica

Princípio: todo número que afeta a jogatina é **visível e computável** — o jogador VÊ os números nos próprios itens e ações e CALCULA sozinho. Planejamento de build é meta-jogo; a jogatina fica fluida, sem telas especiais e sem mecânica oculta.

- **Ficha do personagem**: os 11 stats derivados com valores atuais + 5 atributos + pontos não gastos, sempre visíveis — é o hub de planejamento
- **Itens**: contribuição exata de stats em cada item (§6.1) — `ATQ +8 · PRE +2`. O jogador soma sozinho
- **Ações**: perfil de stats + dificuldade visíveis no card da ação (trampo por abordagem #89: "Stealth — usa Furtividade ★★★ · Esquiva ★★ · Dificuldade 45 · Chance: 72%"; rolê boca/cabeça #96: poder do bando; hacking: camadas + PHK necessário) **+ a chance total de sucesso calculada** (ex: "Chance: 72%") — o resultado da fórmula pública, computado e exibido ao lado do perfil e da dificuldade. O jogador vê os inputs E o output
- **Fórmulas públicas**: as fórmulas de sucesso de trampo, de combate (#186) e de XP (#183) são documentadas in-game (seção de ajuda/manual) — o jogador pode calcular a própria chance antes de agir
- **Aleatoriedade documentada**: os únicos elementos ocultos são os randoms explícitos (random(1..10) no combate, etc.) — tudo mais é determinístico e visível
- **PvP**: stats PRÓPRIOS visíveis; stats do oponente ocultos (anti-scouting — não dá para farmar fraco de olho)
- **UI**: SEM tela especial de briefing — os números vivem onde o jogador já está: ficha, cards de item, cards de missão/ação. Menos fricção, mais fluidez

---

## 2. Banca (Classes)

5 bancas jogáveis, cada uma com uma habilidade especial única:

### Bicho — O Guerreiro de Rua

| Atributo | Valor |
|---|---|
| Atributo primário | Body, Reflexes |
| Habilidade especial | **Combat Trance**: ativa por 30min. +25% Body e Reflexes. 4h cooldown |
| Bônus passivo | +10% dano em PvP, +5% chance crítica |
| Estilo de jogo | Combate direto, proteção de bonde, trampos de wetwork |
| Frase | *"Você não precisa ser mais rápido que a bala. Só mais rápido que o alvo."* |

### Vulto — O Fantasma da Rede

| Atributo | Valor |
|---|---|
| Atributo primário | Intelligence |
| Habilidade especial | **Mergulho**: acessa subnets 1 tier acima do seu nível. 8h cooldown |
| Bônus passivo | +20% RAM, -25% trace gerado |
| Estilo de jogo | Hacking, espionagem digital, suporte ao bonde |
| Frase | *"A fechadura mais forte do mundo não serve de nada se a porta é o cérebro do guarda."* |

### Gambiarrista — O Engenheiro

| Atributo | Valor |
|---|---|
| Atributo primário | Technical |
| Habilidade especial | **Overclock**: próximo upgrade de cromo custa 50% menos e não consome Humanidade. 24h cooldown |
| Bônus passivo | +30% eficiência de crafting, +1 slot de cromo |
| Estilo de jogo | Crafting, upgrades, suporte econômico, sabotagem |
| Frase | *"Toda máquina tem um ponto fraco. Eu encontro. Você explode."* |

### Despachante — O Intermediário

| Atributo | Valor |
|---|---|
| Atributo primário | Cool |
| Habilidade especial | **Silver Tongue**: próximo trampo paga +50% de Grana e +25% de Moral. 12h cooldown |
| Bônus passivo | +15% desconto em vendors, acesso a trampos 1 tier acima |
| Estilo de jogo | Negociação, manipulação de mercado, informação |
| Frase | *"Não importa o que você sabe. Importa quem você conhece. E eu conheço todo mundo."* |

### Estradeiro — O Forasteiro

| Atributo | Valor |
|---|---|
| Atributo primário | Reflexes |
| Habilidade especial | **Long Haul**: realiza 2 trampos simultaneamente (um gasta NIL, outro não). 6h cooldown |
| Bônus passivo | +20% NIL máximo, -20% tempo de viagem entre distritos |
| Estilo de jogo | Alta frequência de trampos, logística, exploração |
| Frase | *"A estrada não tem dono. Só tem quem passa primeiro."* |

---

## 3. Cromo (Cyberware)

O sistema de progressão mais profundo do jogo. Inspirado em Cyberpunk 2077 e CP2020.

### Slots de Cromo

| Slot | Quantidade | Exemplos de implante |
|---|---|---|
| **Frontal Cortex** | 3 | RAM booster, reflex accelerator, neural firewall |
| **Ocular** | 2 | Óptica Vidraça, threat detector, data overlay |
| **Operating System** | 1 | **SO Gazuá** (hacking), **SO Fúria** (combate), **SO Surto** (reflexos) |
| **Arms** | 2 | Braço de Ferro (+Body), Navalha (+Reflexes), Arame (+Cool) |
| **Skeleton** | 2 | Dense marrow (+HP), titanium bones (-dano recebido) |
| **Nervous System** | 3 | Estalo, pain editor, adrenal booster |
| **Circulatory** | 3 | Second heart, biomonitor, auto-injector |
| **Integumentary** | 3 | Casca Grossa, thermal camouflage, shock coating |
| **Legs** | 1 | Fortified ankles (+dodge), lynx paws (+stealth), jump boosters |

### OS (Operating System) — A Decisão de Build

O slot de OS define seu estilo de jogo. **Escolha permanente por rodada** (pode ser trocado com reset).

| OS | Foco | Bônus |
|---|---|---|
| **SO Gazuá** | Hacking | +40% RAM, acesso a quickhacks avançados, +2 slots de programa |
| **SO Fúria** | Combate | +50% Body por 60s (ativável 3x/dia), imunidade a stagger |
| **SO Surto** | Velocidade | +50% Reflexes por 30s (ativável 5x/dia), +25% dodge |

### Tiers de Cromo

| Tier | Nível necessário | Raridade | Custo (G$) | Exemplo |
|---|---|---|---|---|
| T1 | 1 | Common | 500-2.000 | Óptica Vidraça básica |
| T2 | 5 | Uncommon | 2.000-8.000 | Braço de Ferro |
| T3 | 15 | Rare | 8.000-30.000 | Navalha |
| T4 | 30 | Epic | 30.000-100.000 | Surto militar |
| T5 | 50 | Legendary | 100.000+ | Protótipo roubado do Instituto Paraíso |

---

## 4. Sistema de Humanidade / Cyberpsychosis

### Conceito

> *"Cromo te dá poder. Cromo te tira humanidade. A pergunta não é 'quanto você aguenta?'. É 'quanto de você sobra no final?'"*

### Funcionamento

| Parâmetro | Valor |
|---|---|
| **Humanidade base** | 100 |
| **Custo de implante T1** | 2-5 Humanidade |
| **Custo de implante T3** | 10-15 Humanidade |
| **Custo de implante T5** | 20-30 Humanidade |
| **Humanidade recuperável via terapia** | 10-20 por sessão (custa G$ 5.000-20.000, 24h de duração) |

### Limiares de Cyberpsychosis

| Humanidade | Estado | Efeitos |
|---|---|---|
| 100-71 | **Íntegro** | Nenhum efeito negativo |
| 70-41 | **Instável** | 5% de chance de evento agressivo em trampos (atacar aliado, falhar teste social) |
| 40-21 | **Borderline** | 15% de chance de evento. Alucinações (informação falsa na UI). Membros do bonde podem recusar trampos com você |
| 20-1 | **Cyberpsycho** | 30% de chance de evento. Perda de controle (ações aleatórias). A Garra pode ser acionada |
| **0** | **Apagado** | Personagem **perdido permanentemente**. Nome removido dos rankings. Pode ser recriado na PRÓXIMA rodada. Se tiver status de Lenda, nome fica no menu do Saideira |

### Terapia

- Sessões em clínicas (caras, demoradas, restauram Humanidade)
- Terapia de Sintonia (mais barata, menos eficaz)
- Neural Scrubber (implante que remove Humanidade passivamente, mas ocupa slot)

### A Joia do Sistema

> O cromo cria um **teto de build orgânico** — você não sobe infinitamente. Cada melhoria tem um custo. O jogador de elite não é o que tem mais cromo; é o que equilibrou poder e humanidade com mais precisão.

---

## 5. Moral — O Score da Rodada

Inspirado em Cyberpunk 2077 e no "Respeito" do The Crims.

### Como Ganhar

| Ação | Moral ganha |
|---|---|
| Completar trampo T1 | 1-3 |
| Completar trampo T3 | 10-20 |
| Vencer PvP | 5 + bônus de diferença de nível (fórmula abaixo) |
| Hackear subnet corporativa | 5-15 |
| Completar missão diária | 2-5 |
| Bonde ganhar guerra | 15 por membro |

**Bônus de PvP por diferença de nível** (resolve #183): derrubar alguém mais forte dá mais Moral do que atropelar quem está abaixo — anti-grind embutido (atacar alvo muito mais fraco rende menos) e coerente com o range de ataque ±10 níveis (03 §PvP). O bônus nunca zera a vitória (mínimo +2 Moral).

**`bônus = clamp(floor((nível_perdedor − nível_vencedor) / 5), −3, +5)`**

| Cenário | Diferença | Bônus | Moral total |
|---|---|---|---|
| Mesmo nível | 0 | 0 | +5 |
| Vencedor 10 níveis acima (gap máximo) | −10 | −2 | +3 |
| Vencedor 5 níveis acima | −5 | −1 | +4 |
| Vencedor 5 níveis abaixo (virada) | +5 | +1 | +6 |
| Vencedor 10 níveis abaixo (virada máxima) | +10 | +2 | +7 |
| Teto | — | +5 | +10 |

### Thresholds

| Moral | Título | Desbloqueia |
|---|---|---|
| 0 | **Zé Ninguém** | Trampos T1, Babilônia |
| 10 | **Perna** | Acesso ao Saideira, trampos T2, recrutamento para bondes |
| 25 | **Pro** | Trampos T3, despachante Carcará, criação de bonde |
| 50 | **Corredor** | Trampos T4, despachante Cobra, desconto de 10% em vendors |
| 75 | **Elite** | Trampos T5, acesso a As Mortas, desconto de 15% |
| 90 | **Lenda de SP** | Trampos lendários, despachante Coveiro |
| **100** | **Lenda** | **Drink no menu do Saideira — PERMANENTE. Sobrevive a resets.** |

### Decay

- Sem atividade por 7 dias: -5 Moral/dia
- Mínimo: nunca cai abaixo do maior threshold já atingido (ex: se chegou a 50, nunca cai abaixo de 50)

---

## 6. Economia

### Moedas

| Moeda | Símbolo | Uso |
|---|---|---|
| **Grana** | G$ | Moeda principal. Ganhos com trampos, vendas, apostas |
| **Moral** | ★ Moral | Moeda social. Não comprável. Ganha com ações |
| **Créditos** | ₵ (creds) | Moeda premium. Comprada com dinheiro real. Usada para conveniência, cosméticos |

### Fontes de Renda (Faucets)

| Fonte | Frequência | Quantia (G$) |
|---|---|---|
| Trampos | Diário (2-10x) | 500 - 100.000+ |
| Hustle (renda passiva por banca) | Semanal | 500 - 5.000 |
| Venda de Saque | Conforme obtido | Variável |
| Data brokering | Conforme obtido | 1.000 - 50.000 |
| Crafting e venda | Conforme produzido | Variável |

### Sumidouros de Renda (Sinks)

| Sink | Propósito | Custo (G$) |
|---|---|---|
| **Cromo e upgrades** | Progressão vertical | 500 - 500.000+ |
| **Terapia de Humanidade** | Manutenção de build | 5.000 - 20.000/sessão |
| **Resgate** (assinatura) | Seguro contra morte | 500 - 5.000/mês (rodada) |
| **Housing/Lifestyle** | Custo recorrente | 200 - 10.000/mês |
| **Ampolas e consumíveis** | Vantagem temporária | 50 - 10.000 |
| **Informação (Legwork)** | Vantagem em trampos | 100 - 5.000 |

### Resgate — Assinatura Premium (Não-P2W)

O modelo de seguro que funciona como sink econômico e monetização saudável:

| Plano | Custo/mês | Efeito |
|---|---|---|
| **Prata** | G$ 500 | Resgate em 30min. Revive com 60% HP |
| **Ouro** | G$ 2.000 | Resgate em 15min. Revive com 80% HP. +10% de Moral em trampos (confiança do despachante) |
| **Platina** | G$ 10.000 | Resgate em 5min. Revive com 100% HP. Perde apenas 50% da Grana em mãos ao morrer |

**Por que isso funciona**: é um sink de Grana (anti-inflação), uma vantagem que todos podem comprar com moeda do jogo, e a versão premium (Platina) é um objetivo aspiracional, não pay-to-win.

### Preços Fixos por Categoria (Modelo Cyberpunk RED)

Para simplificar a economia e evitar inflação descontrolada:

| Categoria | Faixa de Preço | Exemplos |
|---|---|---|
| Cheap | G$ 10-100 | Pingado, kibble, munição básica |
| Everyday | G$ 100-500 | Refeição, aluguel de coffin, ampola comum |
| Costly | G$ 500-1.000 | Ampolas incomuns, arma básica, cromo T1 |
| Premium | G$ 1.000-5.000 | Cromo T2, arma avançada, terapia básica |
| Expensive | G$ 5.000-20.000 | Cromo T3, estimulantes raros, informação |
| Very Expensive | G$ 20.000-50.000 | Cromo T4, gazuá avançado, cirurgia |
| Luxury | G$ 50.000-100.000 | Cromo T4 premium, veículo |
| Super Luxury | G$ 100.000+ | Cromo T5, itens lendários, propriedade |

---

## 6.1 Inventário e Equipamento (resolve #185)

Modelo **slot-based** (sem peso) — mais simples que peso para PBBG: sem matemática de encumbrance, sem UI de gerenciamento de peso. Interliga: #183 (nível gateia tier de item), #184 (itens modificam stats derivados), #186 (combate consome itens/munição), #93 (crafting produz itens), #96 (rolê dropa componentes).

### Modelo de Slots

| Parâmetro | Valor |
|---|---|
| Capacidade base | **20 slots** |
| Expansão por nível | +5 no nível 10, +5 no nível 25, +5 no nível 40 (gates de §1) |
| Expansão comprável | +5 em Babilônia, **G$ 10.000**, 1x por rodada (sink de Grana) |
| Capacidade máxima | **40 slots** |
| Stack | Consumível, munição e componente: **stack até 99**. Arma, proteção, roupa, acessório, blueprint e item de missão: **1 por slot** (não stackam) |
| Reset | **Inventário e equipamento zeram** (§7 "Reset de inventário"). Nada de equipamento sobrevive — progressão permanente é só prestígio (Hall de Lendas + Universidade T3) |

### Categorias de Item (10)

| Categoria | Stack | Exemplos |
|---|---|---|
| Arma de fogo | Não | Pistola, SMG, fuzil, escopeta, sniper |
| Arma branca | Não | Facão, navalha, machete, katana |
| Granada/Explosivo | Sim (10) | Coquetel, granada, carga de demolição |
| Proteção | Não | Colete, blindagem, exoesqueleto |
| Roupa | Não | Terno, traje, camuflagem |
| Munição | Sim (99) | Por classe de arma |
| Consumível | Sim (99) | Ampolas (03 §5) |
| Componente | Sim (99) | Matéria-prima de crafting (#93) e rolê (#96) |
| Blueprint | Não | Receita de crafting (#93) |
| Item de missão | Não | Item narrativo, não-vendável, zera no reset |

### Slots de Equipamento (4 — separados dos 9 de cromo)

| Slot | O que equipa | Decisão |
|---|---|---|
| **Arma Primária** | Arma de fogo | Dano principal |
| **Arma Secundária** | Arma de fogo OU arma branca | Backup / combate silencioso |
| **Corpo** | Proteção **OU** roupa | **Um slot, escolha importa**: colete (DEF/HP) vs roupa (FUR/INF) — nunca os dois |
| **Acessório** | 1 item | INI, PRE ou PHK |

Cromo continua nos 9 slots próprios (§3). Equipamento e cromo são **sistemas paralelos**: cromo é progressão vertical paga em Humanidade; equipamento é progressão horizontal comprada em Grana e gateada por nível (§1).

### Stats de Item por Categoria

| Categoria | Stats que modifica |
|---|---|
| Arma de fogo | **dano** (base de dano no combate, 03 §3), **PRE** (+precisão), **INI** (+cadência, só SMG), classe de munição |
| Arma branca | **dano**, **FUR** (+silenciosa), sem munição |
| Granada | **dano fixo em área**, uso único **antes da rolagem**, ignora DEF (modificador de dano da rolagem única, 03 §3) |
| Proteção | **DEF**, **HP máx** |
| Roupa | **FUR** ou **INF** (cada peça favorece um) |
| Acessório | **INI**, **PRE** ou **PHK** |
| Munição | Classe + quantidade; consumida por ataque PvP e por trampo Assault |
| Consumível | Buffs temporários (ampolas, 03 §5) |
| Componente | Sem stat — matéria-prima |
| Blueprint | Sem stat — receita |
| Item de missão | Sem stat — progressão narrativa |

### Durabilidade — NÃO

**Sem durabilidade.** PBBG simples não tem reparo (lição do gênero). Os sinks de Grana já existem: munição (recorrente), consumíveis, cromo, terapia, Resgate. Durabilidade adicionaria timer de manutenção sem adicionar decisão — cortada.

### Munição

- **Por classe de arma**: Pistola, SMG, Rifle, Escopeta, Sniper. Cada arma consome a munição da classe.
- **Consumo**: **1 unidade por ataque PvP** (rolagem única, 03 §3) e **1 unidade por trampo Assault** (execute). Stealth e Netrun não consomem (silencioso/remoto).
- **Compra**: Babilônia (hub) e vendors de gangue. Preço por stack de 10 (catálogo abaixo).
- **Função econômica**: sink recorrente de Grana (anti-inflação, §6) + teto natural de combate (sem munição, sem Assault).

### Catálogo Inicial T1-T5

Tiers de item espelham os gates de nível (§1: T1=1, T2=5, T3=15, T4=30, T5=50) e a tabela de preços de §6 (Cheap G$10-100 → Super Luxury G$100.000+) — nenhuma categoria nova de preço é necessária.

**Armas de fogo** (dano = base no combate 03 §3; PRE/INI = bônus no stat derivado §1.1):

| Item | Tier | Nível | Preço (G$) | Categoria | Dano | Bônus |
|---|---|---|---|---|---|---|
| Pistola Marvada | T1 | 1 | 800 | Costly | 8 | PRE +2 |
| SMG Tietê | T2 | 5 | 3.500 | Premium | 12 | PRE +3, INI +2 |
| Fuzil Bandeirante | T3 | 15 | 12.000 | Expensive | 18 | PRE +5 |
| Escopeta Viaduto | T4 | 30 | 35.000 | Very Expensive | 26 | PRE +2 |
| Precisão Anhangabaú | T5 | 50 | 80.000 | Luxury | 35 | PRE +8 |

**Armas brancas** (sem munição, bônus de furtividade):

| Item | Tier | Nível | Preço (G$) | Categoria | Dano | Bônus |
|---|---|---|---|---|---|---|
| Facão da Feira | T1 | 1 | 50 | Cheap | 5 | FUR +1 |
| Navalha de Ogum | T2 | 5 | 900 | Costly | 9 | FUR +2 |
| Machete do Cinturão | T3 | 15 | 6.000 | Expensive | 14 | FUR +3 |
| Katana da 25 | T4 | 30 | 25.000 | Very Expensive | 20 | FUR +4 |

**Granadas** (dano fixo em área, ignora DEF, uso único antes da rolagem — modificador de dano da rolagem única):

| Item | Tier | Nível | Preço (G$) | Categoria | Dano |
|---|---|---|---|---|---|
| Coquetel de Garrafa | T1 | 1 | 30 | Cheap | 15 |
| Granada de Prego | T2 | 5 | 400 | Everyday | 25 |
| Carga de Demolição | T3 | 15 | 4.000 | Premium | 40 |

**Proteção** (DEF + HP):

| Item | Tier | Nível | Preço (G$) | Categoria | DEF | HP |
|---|---|---|---|---|---|---|
| Colete de Couro | T1 | 1 | 300 | Everyday | +2 | +5 |
| Colete da Zona Leste | T2 | 5 | 2.500 | Premium | +4 | +10 |
| Blindagem de Container | T3 | 15 | 15.000 | Expensive | +7 | +20 |
| Exoesqueleto do Fervo | T4 | 30 | 45.000 | Very Expensive | +10 | +30 |

**Roupa** (FUR ou INF — escolha de build):

| Item | Tier | Nível | Preço (G$) | Categoria | Bônus |
|---|---|---|---|---|---|
| Camisa de Malandro | T1 | 1 | 100 | Everyday | INF +1 |
| Terno do Fluxo | T2 | 5 | 1.500 | Premium | INF +3 |
| Traje de Vulto | T3 | 15 | 8.000 | Expensive | FUR +4 |
| Camuflagem Fantasma | T4 | 30 | 30.000 | Very Expensive | FUR +6 |

**Munição** (stack 10):

| Item | Tier | Preço (G$) | Categoria | Nota |
|---|---|---|---|---|
| Munição Comum | T1 | 20 | Cheap | Todas as classes |
| Munição de Grau Militar | T2 | 150 | Everyday | +1 dano (multiplica no combate) |
| Munição Perfurante | T3 | 800 | Costly | Ignora 2 de DEF |

**Acessórios**:

| Item | Tier | Nível | Preço (G$) | Categoria | Bônus |
|---|---|---|---|---|---|
| Chip Frio | T1 | 1 | 200 | Everyday | PHK +1 |
| Lente de Mira | T2 | 5 | 2.000 | Premium | PRE +2 |
| Estimulador Neural | T3 | 15 | 10.000 | Expensive | INI +3 |

**Componentes** (do rolê #96, alimentam crafting #93): Peça de Sucata, Muda Sintética, Fragmento de Estática, Cromo Dourado, Identidade Descartável, Munição de Grau Militar, Contrato de Proteção, Cromo de Necrópole. **Blueprints**: T1-T5, drop de trampo/vendor/crafting. **Consumíveis**: ampolas existentes (Pingado G$50 etc., 03 §5).

### Fontes

| Fonte | O que fornece |
|---|---|
| **Vendors por distrito/facção** | Babilônia (hub, tudo T1-T3), gangues (itens temáticos, ex: Maré de Ferro vende munição militar), corps (armory do Falcão — arma de fogo premium, 02 §Corporações) |
| **Saque de trampo** | Armas T1-T2, munição, consumíveis, blueprints |
| **Saque de rolê** (#96) | Componentes de gangue, munição militar, peças de cromo |
| **Crafting** (#93) | Itens T2-T5 a partir de componentes + blueprints (eficiência = TEC + Gambiarrista +30% + Concreta +20%) |

### Contribuição de Stats Visível (Metrificação)

- Todo item equipável mostra sua contribuição EXATA de stats em TODA superfície: vendor, inventário, Saque, crafting, equipamento — formato estático: `ATQ +8 · PRE +2` (o bônus que o item dá, não delta computado vs equipamento atual)
- O JOGADOR calcula: soma os bônus aos stats da ficha (§1.1) e decide o que comprar/equipar. Sem UI de simulação — os números visíveis bastam (planejamento é parte do jogo)

### Descrições em Dois Níveis (padrão de conteúdo obrigatório)

- **Descrição curta (obrigatória, todo item)**: apenas informação mecânica clara — stats, efeitos, requisitos, classe de munição, tier/nível. Zero lore. Ex: `Dano 8 · PRE +2 · Munição Pistola · Nível 1`
- **Descrição longa**: lore/marca própria + o conteúdo da curta expandido. Ex: Pistola Marvada — fabricada na Quebrada, arma de entrada dos corredores… (lore) + Dano 8, PRE +2, Munição Pistola, Nível 1
- **Mais exemplos do catálogo**:
  - **Traje de Vulto** — curta: `FUR +4 · Nível 15` · longa: alfaiate do Cinturão que veste quem não quer ser visto (lore) + FUR +4, Nível 15
  - **Granada de Prego** — curta: `Dano 25 em área · Ignora DEF · Uso único antes da rolagem · Nível 5` · longa: lata de conserva recheada de pregos da obra do Viaduto (lore) + Dano 25 em área, ignora DEF, uso único antes da rolagem, Nível 5
  - **Munição Perfurante** — curta: `Ignora 2 de DEF · Stack 10 · Tier 3` · longa: ponta de tungstênio usinada na Zona Leste, fura colete como papel (lore) + ignora 2 de DEF, stack 10, Tier 3
- **Aplica a TODO item em TODA superfície**: lojas, inventário, Saque, crafting, equipamento, cromo (§3), consumíveis (03 §5), munição, granadas, componentes, blueprints — inclusive itens já existentes ganham os dois campos
- **UI**: a curta é o padrão visível (cards, listas, tooltips); a longa aparece em detalhe/expandir (modal, tooltip longo, página de item)
- **Schema**: cada definição de item ganha `description_short` + `description_long` (definições de cromo e consumíveis idem)

---

## 7. Rodadas e Prestígio (O Sistema de Lendas)

### O Sistema de Rodada

- Cada rodada dura **14 dias** (2 semanas)
- Ao final da rodada:
  - **Reset de inventário, Grana, nível e Moral**
  - **Humanidade reseta para 100**
  - **TUDO é perdido, EXCETO o que está no Hall de Lendas**

### Hall de Lendas — O Prestígio Permanente

Inspirado diretamente no modelo de **Ascensão do Kingdom of Loathing** — o motor de replay mais poderoso encontrado na pesquisa:

| Conquista | Condição | Recompensa Permanente |
|---|---|---|
| **Lenda** | Atingir Moral 100 em qualquer rodada | **Drink nomeado no menu do Saideira** (permanente) + badge "Lenda" |
| **Speed Demon** | Completar 50 trampos em uma rodada | +5 NIL máximo permanente |
| **Net God** | Hackear 20 subnets corporativas em uma rodada | +10% RAM permanente |
| **Warlord** | Vencer 3 guerras de bondes em uma rodada | +5% dano PvP permanente |
| **Rich Bitch** | Acumular G$ 500.000 em uma rodada | +10% de Grana em trampos permanente |
| **Unkillable** | Sobreviver com <10 Humanidade por 3 dias | +10 Humanidade base permanente |
| **Completionist** | Completar pelo menos 1 trampo de cada tipo em uma rodada | +1 ponto de atributo livre permanente |

### O Drink — A Imortalidade Social

Quando um jogador atinge Moral 100 (Lenda):

1. Seu nome é adicionado ao menu do **Saideira**
2. Um drink é criado em sua homenagem (nome escolhido pelo jogador, dentro de diretrizes)
3. Este drink é **PERMANENTE** — visível para todos os jogadores em todas as rodadas futuras
4. O menu exibe: nome do jogador, nome do drink, data em que atingiu Lenda, bonde a que pertencia

> *"Você pode perder tudo no reset. Sua Grana, seu cromo, seu nível. Mas ninguém tira seu nome do menu."*

Este é o prestige reward definitivo — alinhado ao lore do gênero (drinks da Saideira), ao sistema de prestígio de KoL (Ascensão com benefício permanente) e ao que The Crims tentou fazer com medalhas.
