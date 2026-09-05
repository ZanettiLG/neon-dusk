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
| Vencer PvP | 5 (+ bônus de diferença de nível) |
| Hackear subnet corporativa | 5-15 |
| Completar missão diária | 2-5 |
| Bonde ganhar guerra | 15 por membro |

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

## 8. Universidade — Cursinho da Quebrada

### Conceito

> *"A rua ensina de graça. O Cursinho cobra caro — porque o que ele ensina, a rua cobra mais caro ainda."*

A universidade do submundo. Galpão de 3 andares na Babilônia, entre a galeria de eletrônicos e o Saideira. Porta de aço, placa pichada: "CURSINHO DA QUEBRADA" — o S caiu em 2081 e ninguém consertou. O nome é marca, não endereço: o Cursinho fica na Babilônia, mas é da quebrada.

Professor é corredor aposentado, Ferrageiro sem cliente, Vulto queimado, despachante que devia dinheiro pra gente errada. Todos ensinam o que aprenderam — pelo preço certo. Não tem diploma de verdade. Tem contrato. E o contrato é claro: você paga, eles ensinam, e o que você aprende é seu. Pra sempre.

### As Duas Portas

| Instituição | Distrito | Moeda | O que ensina | Preço escondido |
|---|---|---|---|---|
| **Cursinho da Quebrada** | Babilônia | G$ | O corre de rua: briga, tiro, gambiarra, malemolência | Nenhum. O conhecimento é sujo, mas é seu |
| **Instituto Paraíso** | A Paraíso | ₵ | "Expansão cognitiva assistida": Netrun profundo, cromo neural, Sobrevivência de elite | **Humanidade**. O folheto promete uma mente mais clara. Os andares de baixo não têm janela |

### Cursos (6)

Cada curso é uma área do corre. Cada um tem 3 tiers. Cada tier tem um bônus na rodada — e o T3 tem um bônus permanente.

| Curso | Área | Atributo | Bônus permanente (T3) |
|---|---|---|---|
| **Briga** | Combate corpo a corpo | Body | +1 BOD base |
| **Mira** | Tiro e reflexos | Reflexes | +1 REF base |
| **Netrun** | Hacking e Rede | Intelligence | +1 INT base |
| **Gambiarra** | Engenharia e crafting | Technical | +1 TEC base |
| **Malemolência** | Social e presença | Cool | +1 COL base |
| **Sobrevivência** | Rua e resistência | Geral | +10 NIL máximo |

### Tiers

| Tier | Nome | Custo (G$) | Duração | Requisitos | Bônus na rodada | Bônus permanente |
|---|---|---|---|---|---|---|
| T1 | Básico | 20.000 | 24h | Nível 5, Moral 10, atributo 10 | +1 atributo na área | — |
| T2 | Avançado | 50.000 | 48h | Nível 15, Moral 25, atributo 12 | +2 atributo na área | — |
| T3 | Master | 100.000 | 72h | Nível 30, Moral 50, atributo 15 | +3 atributo na área | **+1 atributo base** |

- **Bônus na rodada é cumulativo**: curso completo (T1+T2+T3) = +3 atributo na área durante a rodada.
- **Bônus permanente é único**: fez o T3 uma vez, o +1 base é seu pra sempre. Refazer o curso na próxima rodada não acumula — só renova o bônus da rodada. Máximo de +6 atributo base e +10 NIL máximo vindos da Universidade.
- Cada tier consome **20 NIL** ao iniciar (a aula inaugural). O resto roda sozinho — timer idle.

### Instituto Paraíso — A Porta Corporativa

Mesmos 6 cursos, mesmos tiers. A diferença é o preço:

| Tier | Custo (₵) | Custo oculto | Bônus |
|---|---|---|---|
| T1 | 50₵ | -10 Humanidade | +1 atributo na área |
| T2 | 100₵ | -10 Humanidade | +2 atributo na área |
| T3 | 150₵ | -10 Humanidade | +1 atributo base + **1 slot de cromo neural** |

- O Instituto cobra em Créditos (₵) — conveniência, nunca poder. O Cursinho cobra em Grana; o Instituto cobra em Créditos **e** Humanidade.
- O bônus permanente do T3 é o mesmo do Cursinho (+1 atributo base, ou +10 NIL máximo no caso de Sobrevivência) — o Instituto adiciona o slot de cromo neural por cima.
- O T3 do Instituto desbloqueia **cromo exclusivo**: +1 slot de cromo neural permanente. "Enriquecimento de longo prazo" — os cérebros que entram no programa nunca mais produzem um pensamento que o Instituto não tenha implantado primeiro.

### Permanente vs Temporário

| Bônus | Tipo | Sobrevive ao reset? |
|---|---|---|
| +1/+2/+3 atributo na área (tiers) | Temporário | Não — reseta com a rodada |
| +1 atributo base (T3) | Permanente | **Sim** — como o Hall de Lendas (§7) |
| +10 NIL máximo (Sobrevivência T3) | Permanente | **Sim** |
| +1 slot de cromo neural (Instituto T3) | Permanente | **Sim** |
| Diploma (título no perfil) | Permanente | **Sim** — cosmético |

- **Diploma**: completar o T3 de um curso concede um título exibido no perfil (ex: "Formado em Briga — Cursinho da Quebrada"). Cosmético, como o drink do Saideira — ninguém tira seu nome do quadro.

### Integração com Simuladores (#79)

Simuladores e Universidade dividem o mesmo **slot de treino** (1 por personagem). Você treina ou estuda — não os dois ao mesmo tempo.

| | Simuladores | Universidade |
|---|---|---|
| Timer | 30min-1h por sessão | 24-72h por tier |
| Custo | NIL ou Grana | G$ ou ₵ |
| Bônus | +1 atributo por sessão (na rodada) | +1/+2/+3 atributo (na rodada) + permanente no T3 |
| Bônus de bonde | +10%/nível (até +100%) | — |
| Sobrevive ao reset? | Não | T3 sim |

- **Fluxo**: Simuladores sobem atributos na rodada → Universidade exige atributo 15 no T3 (o soft cap do §1) → o T3 converte o progresso da rodada em bônus permanente.
- **Soft cap 15**: depois de 15, o custo dobra (§1). O +1 base permanente da Universidade é o caminho de longo prazo — a cada rodada, você começa mais perto do teto.

### Requisitos

| Requisito | T1 | T2 | T3 |
|---|---|---|---|
| Nível | 5 | 15 | 30 |
| Moral | 10 (Perna) | 25 (Pro) | 50 (Corredor) |
| Atributo da área | 10 | 12 | 15 |
| Grana | G$ 20.000 | G$ 50.000 | G$ 100.000 |
| NIL (início do tier) | 20 | 20 | 20 |

### Regras de Matrícula

- **1 curso por vez** — o slot de treino é único (compartilhado com Simuladores).
- **Matrícula não reembolsável** — trancou, perdeu a grana. O Cursinho não devolve nada. Nem o Instituto.
- **Timer idle** — o curso roda sozinho. Pode deslogar. Volta quando termina.
- **Bônus de bonde não se aplica** — Universidade é estudo individual. Bonde ajuda no Simulador, não na prova.

> **Nota**: Universidade é Fase 2 (issue #91). Simuladores (#79) é o pré-requisito de treino.
