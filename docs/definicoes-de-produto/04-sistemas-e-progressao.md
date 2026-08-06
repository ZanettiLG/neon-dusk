# Sistemas e Progressão

## 1. Atributos

Baseado no sistema Cyberpunk RED (10 atributos), simplificado para 5 atributos com escala 1-20.

### Os 5 Atributos

| Atributo | Símbolo | Descrição | Afeta | Classe Primária |
|---|---|---|---|---|
| **Body** | BOD | Força física, resistência, tolerância a dor e chrome | Dano corpo a corpo, HP, capacidade de chrome físico | Solo |
| **Reflexes** | REF | Velocidade, coordenação, reflexos de combate | Chance de crítico, esquiva, velocidade de gig | Solo, Nomad |
| **Intelligence** | INT | Capacidade cognitiva, hacking, análise | RAM de hacking, sucesso em Netrun, learn rate | Netrunner |
| **Technical** | TEC | Habilidade técnica, engenharia, crafting | Eficiência de crafting, upgrades de chrome, lockpicking | Tech |
| **Cool** | COL | Autocontrole, presença, manipulação social, resistência a stress | Sucesso social, street cred ganha, resistência a cyberpsychosis | Fixer |

### Progressão

- Começa com 3 pontos em cada atributo + 7 pontos livres
- **+1 ponto de atributo por nível** (max 50 níveis na rodada)
- Cap por atributo: 20
- **Soft cap**: após 15, custo dobra (2 pontos de atributo para subir 1)

---

## 2. Roles (Classes)

5 roles jogáveis, cada um com uma habilidade especial única:

### Solo — O Guerreiro de Rua

| Atributo | Valor |
|---|---|
| Atributo primário | Body, Reflexes |
| Habilidade especial | **Combat Trance**: ativa por 30min. +25% Body e Reflexes. 4h cooldown |
| Bônus passivo | +10% dano em PvP, +5% chance crítica |
| Estilo de jogo | Combate direto, proteção de crew, gigs de wetwork |
| Frase | *"Você não precisa ser mais rápido que a bala. Só mais rápido que o alvo."* |

### Netrunner — O Fantasma da Rede

| Atributo | Valor |
|---|---|
| Atributo primário | Intelligence |
| Habilidade especial | **Deep Dive**: acessa subnets 1 tier acima do seu nível. 8h cooldown |
| Bônus passivo | +20% RAM, -25% trace gerado |
| Estilo de jogo | Hacking, espionagem digital, suporte à crew |
| Frase | *"A fechadura mais forte do mundo não serve de nada se a porta é o cérebro do guarda."* |

### Tech — O Engenheiro

| Atributo | Valor |
|---|---|
| Atributo primário | Technical |
| Habilidade especial | **Overclock**: próximo upgrade de chrome custa 50% menos e não consome Humanidade. 24h cooldown |
| Bônus passivo | +30% eficiência de crafting, +1 slot de chrome |
| Estilo de jogo | Crafting, upgrades, suporte econômico, sabotagem |
| Frase | *"Toda máquina tem um ponto fraco. Eu encontro. Você explode."* |

### Fixer — O Intermediário

| Atributo | Valor |
|---|---|
| Atributo primário | Cool |
| Habilidade especial | **Silver Tongue**: próximo gig paga +50% eddies e +25% Street Cred. 12h cooldown |
| Bônus passivo | +15% desconto em vendors, acesso a gigs 1 tier acima |
| Estilo de jogo | Negociação, manipulação de mercado, informação |
| Frase | *"Não importa o que você sabe. Importa quem você conhece. E eu conheço todo mundo."* |

### Nomad — O Forasteiro

| Atributo | Valor |
|---|---|
| Atributo primário | Reflexes |
| Habilidade especial | **Long Haul**: realiza 2 gigs simultaneamente (um gasta NIL, outro não). 6h cooldown |
| Bônus passivo | +20% NIL máximo, -20% tempo de viagem entre distritos |
| Estilo de jogo | Alta frequência de gigs, logística, exploração |
| Frase | *"A estrada não tem dono. Só tem quem passa primeiro."* |

---

## 3. Chrome (Cyberware)

O sistema de progressão mais profundo do jogo. Inspirado em Cyberpunk 2077 e CP2020.

### Slots de Chrome

| Slot | Quantidade | Exemplos de implante |
|---|---|---|
| **Frontal Cortex** | 3 | RAM booster, reflex accelerator, neural firewall |
| **Ocular** | 2 | Kiroshi optics, threat detector, data overlay |
| **Operating System** | 1 | **Cyberdeck** (hacking), **Berserk** (combate), **Sandevistan** (reflexos) |
| **Arms** | 2 | Gorilla Arms (+Body), Mantis Blades (+Reflexes), Monowire (+Cool) |
| **Skeleton** | 2 | Dense marrow (+HP), titanium bones (-dano recebido) |
| **Nervous System** | 3 | Reflex tuner, pain editor, adrenal booster |
| **Circulatory** | 3 | Second heart, biomonitor, auto-injector |
| **Integumentary** | 3 | Subdermal armor, thermal camouflage, shock coating |
| **Legs** | 1 | Fortified ankles (+dodge), lynx paws (+stealth), jump boosters |

### OS (Operating System) — A Decisão de Build

O slot de OS define seu estilo de jogo. **Escolha permanente por rodada** (pode ser trocado com reset).

| OS | Foco | Bônus |
|---|---|---|
| **Cyberdeck** | Hacking | +40% RAM, acesso a quickhacks avançados, +2 slots de programa |
| **Berserk** | Combate | +50% Body por 60s (ativável 3x/dia), imunidade a stagger |
| **Sandevistan** | Velocidade | +50% Reflexes por 30s (ativável 5x/dia), +25% dodge |

### Tiers de Chrome

| Tier | Nível necessário | Raridade | Custo (€$) | Exemplo |
|---|---|---|---|---|
| T1 | 1 | Common | 500-2.000 | Kiroshi Optics básico |
| T2 | 5 | Uncommon | 2.000-8.000 | Gorilla Arms |
| T3 | 15 | Rare | 8.000-30.000 | Mantis Blades |
| T4 | 30 | Epic | 30.000-100.000 | Sandevistan militar |
| T5 | 50 | Legendary | 100.000+ | Protótipo roubado do Instituto Paraíso |

---

## 4. Sistema de Humanidade / Cyberpsychosis

### Conceito

> *"Chrome te dá poder. Chrome te tira humanidade. A pergunta não é 'quanto você aguenta?'. É 'quanto de você sobra no final?'"*

### Funcionamento

| Parâmetro | Valor |
|---|---|
| **Humanidade base** | 100 |
| **Custo de implante T1** | 2-5 Humanidade |
| **Custo de implante T3** | 10-15 Humanidade |
| **Custo de implante T5** | 20-30 Humanidade |
| **Humanidade recuperável via terapia** | 10-20 por sessão (custa €$ 5.000-20.000, 24h de duração) |

### Limiares de Cyberpsychosis

| Humanidade | Estado | Efeitos |
|---|---|---|
| 100-71 | **Íntegro** | Nenhum efeito negativo |
| 70-41 | **Instável** | 5% de chance de evento agressivo em gigs (atacar aliado, falhar teste social) |
| 40-21 | **Borderline** | 15% de chance de evento. Alucinações (informação falsa na UI). Crew members podem recusar gigs com você |
| 20-1 | **Cyberpsycho** | 30% de chance de evento. Perda de controle (ações aleatórias). MaxTac pode ser acionado |
| **0** | **Flatline** | Personagem **perdido permanentemente**. Nome removido dos rankings. Pode ser recriado na PRÓXIMA rodada. Se tiver status de Lenda, nome fica no menu do Saideira |

### Terapia

- Sessões em clínicas (caras, demoradas, restauram Humanidade)
- Braindance therapy (mais barata, menos eficaz)
- Neural Scrubber (implante que remove Humanidade passivamente, mas ocupa slot)

### A Joia do Sistema

> O chrome cria um **teto de build orgânico** — você não sobe infinitamente. Cada melhoria tem um custo. O jogador de elite não é o que tem mais chrome; é o que equilibrou poder e humanidade com mais precisão.

---

## 5. Street Cred — O Score da Rodada

Inspirado em Cyberpunk 2077 e no "Respeito" do The Crims.

### Como Ganhar

| Ação | SC ganho |
|---|---|
| Completar gig T1 | 1-3 |
| Completar gig T3 | 10-20 |
| Vencer PvP | 5 (+ bônus de diferença de nível) |
| Hackear subnet corporativa | 5-15 |
| Completar missão diária | 2-5 |
| Crew ganhar guerra | 15 por membro |

### Thresholds

| SC | Título | Desbloqueia |
|---|---|---|
| 0 | **Unknown** | Gigs T1, Babilônia |
| 10 | **Runner** | Acesso ao Saideira, gigs T2, recrutamento para crews |
| 25 | **Pro** | Gigs T3, fixer Carcará, criação de crew |
| 50 | **Edgerunner** | Gigs T4, fixer Cobra, desconto de 10% em vendors |
| 75 | **Elite** | Gigs T5, acesso a As Mortas, desconto de 15% |
| 90 | **Night City Legend** (provisório) | Gigs lendários, fixer Coveiro |
| **100** | **Legend** | **Drink no menu do Saideira — PERMANENTE. Sobrevive a resets.** |

### Decay

- Sem atividade por 7 dias: -5 SC/dia
- Mínimo: nunca cai abaixo do maior threshold já atingido (ex: se chegou a 50, nunca cai abaixo de 50)

---

## 6. Economia

### Moedas

| Moeda | Símbolo | Uso |
|---|---|---|
| **Eurodollars** | €$ (eddies) | Moeda principal. Ganhos com gigs, vendas, apostas |
| **Street Cred** | SC | Moeda social. Não comprável. Ganha com ações |
| **Créditos** | ₵ (creds) | Moeda premium. Comprada com dinheiro real. Usada para conveniência, cosméticos |

### Fontes de Renda (Faucets)

| Fonte | Frequência | Quantia (€$) |
|---|---|---|
| Gigs | Diário (2-10x) | 500 - 100.000+ |
| Hustle (renda passiva por role) | Semanal | 500 - 5.000 |
| Venda de loot | Conforme obtido | Variável |
| Data brokering | Conforme obtido | 1.000 - 50.000 |
| Crafting e venda | Conforme produzido | Variável |

### Sumidouros de Renda (Sinks)

| Sink | Propósito | Custo (€$) |
|---|---|---|
| **Chrome e upgrades** | Progressão vertical | 500 - 500.000+ |
| **Terapia de Humanidade** | Manutenção de build | 5.000 - 20.000/sessão |
| **Trauma Team** (assinatura) | Seguro contra morte | 500 - 5.000/mês (rodada) |
| **Housing/Lifestyle** | Custo recorrente | 200 - 10.000/mês |
| **Stims e consumíveis** | Vantagem temporária | 50 - 10.000 |
| **Informação (Legwork)** | Vantagem em gigs | 100 - 5.000 |

### Trauma Team — Assinatura Premium (Não-P2W)

O modelo de seguro que funciona como sink econômico e monetização saudável:

| Plano | Custo/mês | Efeito |
|---|---|---|
| **Silver** | €$ 500 | Resgate em 30min. Revive com 60% HP |
| **Gold** | €$ 2.000 | Resgate em 15min. Revive com 80% HP. +10% SC em gigs (confiança do fixer) |
| **Platinum** | €$ 10.000 | Resgate em 5min. Revive com 100% HP. Perde apenas 50% dos eddies em mãos ao morrer |

**Por que isso funciona**: é um sink de eddies (anti-inflação), uma vantagem que todos podem comprar com moeda do jogo, e a versão premium (Platinum) é um objetivo aspiracional, não pay-to-win.

### Preços Fixos por Categoria (Modelo Cyberpunk RED)

Para simplificar a economia e evitar inflação descontrolada:

| Categoria | Faixa de Preço | Exemplos |
|---|---|---|
| Cheap | €$ 10-100 | Syn-café, kibble, munição básica |
| Everyday | €$ 100-500 | Refeição, aluguel de coffin, stim comum |
| Costly | €$ 500-1.000 | Stims incomuns, arma básica, chrome T1 |
| Premium | €$ 1.000-5.000 | Chrome T2, arma avançada, terapia básica |
| Expensive | €$ 5.000-20.000 | Chrome T3, estimulantes raros, informação |
| Very Expensive | €$ 20.000-50.000 | Chrome T4, deck avançado, cirurgia |
| Luxury | €$ 50.000-100.000 | Chrome T4 premium, veículo |
| Super Luxury | €$ 100.000+ | Chrome T5, itens lendários, propriedade |

---

## 7. Rodadas e Prestígio (O Sistema de Lendas)

### O Sistema de Rodada

- Cada rodada dura **14 dias** (2 semanas)
- Ao final da rodada:
  - **Reset de inventário, eddies, nível e Street Cred**
  - **Humanidade reseta para 100**
  - **TUDO é perdido, EXCETO o que está no Hall de Lendas**

### Hall de Lendas — O Prestígio Permanente

Inspirado diretamente no modelo de **Ascensão do Kingdom of Loathing** — o motor de replay mais poderoso encontrado na pesquisa:

| Conquista | Condição | Recompensa Permanente |
|---|---|---|
| **Legend** | Atingir SC 100 em qualquer rodada | **Drink nomeado no menu do Saideira** (permanente) + badge "Legend" |
| **Speed Demon** | Completar 50 gigs em uma rodada | +5 NIL máximo permanente |
| **Net God** | Hackear 20 subnets corporativas em uma rodada | +10% RAM permanente |
| **Warlord** | Vencer 3 crew wars em uma rodada | +5% dano PvP permanente |
| **Rich Bitch** | Acumular €$ 500.000 em uma rodada | +10% eddies de gigs permanente |
| **Unkillable** | Sobreviver com <10 Humanidade por 3 dias | +10 Humanidade base permanente |
| **Completionist** | Completar pelo menos 1 gig de cada tipo em uma rodada | +1 ponto de atributo livre permanente |

### O Drink — A Imortalidade Social

Quando um jogador atinge SC 100 (Legend):

1. Seu nome é adicionado ao menu do **Saideira**
2. Um drink é criado em sua homenagem (nome escolhido pelo jogador, dentro de diretrizes)
3. Este drink é **PERMANENTE** — visível para todos os jogadores em todas as rodadas futuras
4. O menu exibe: nome do jogador, nome do drink, data em que atingiu Legend, crew a que pertencia

> *"Você pode perder tudo no reset. Seus eddies, seu chrome, seu nível. Mas ninguém tira seu nome do menu."*

Este é o prestige reward definitivo — alinhado ao lore de Cyberpunk 2077 (drinks da Afterlife), ao sistema de prestígio de KoL (Ascensão com benefício permanente) e ao que The Crims tentou fazer com medalhas.
