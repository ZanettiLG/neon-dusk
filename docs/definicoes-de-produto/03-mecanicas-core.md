# Mecânicas Core

## Visão Geral dos Sistemas

Neon Dusk traduz CADA mecânica comprovada dos PBBGs de sucesso (The Crims, Torn, KoL) para o universo cyberpunk. A tabela abaixo mostra o mapeamento completo:

| Mecânica PBBG | The Crims | Neon Dusk | Inspiração (referência) |
|---|---|---|---|
| Energia | Stamina/Tickets | **Neural Interface Load (NIL)** | Cyberware Capacity (2077), RAM (2077) |
| Ações | Crimes/Roubos | **Trampos** (por tier e despachante) | missões do gênero (CP2077), Shadowrun loop 5 fases |
| Consumíveis | Drogas (14) | **Ampolas** (8 tipos) | Combat drugs TTRPG, brilho |
| Gangues | Gangues | **Bondes** (5 bancas + 1 líder) | bonde de mercenários |
| Score | Respeito | **Moral** (0-100) | Reputação de rua (CP2077) |
| Treino | Treino/Universidade | **Cromo + Simuladores** | Médicos de cromo (RED), Humanity Cost |
| Economia | $ + Banco + Bolsa | **Grana + Fachadas + Resgate** | Eurodollar, RED Price Categories |
| Casino | Blackjack/Slots/Loteria | **Submundo** (arenas, apostas, mercado de dados) | Anjos de Cromo (arenas), O Comando (cassinos) |

---

## 1. Neural Interface Load (NIL) — Sistema de Energia

### Conceito

Toda ação significativa em São Paulo exige interface neural — seus implantes processam dados, calculam trajetórias, sobrepõem informações no seu campo de visão. Este processamento gera fadiga neural, medida como **Neural Interface Load (NIL)** .

### Funcionamento

| Parâmetro | Valor | Nota |
|---|---|---|
| **NIL máximo base** | 100 | Aumenta com cromo neural (+10 por tier de implante neural) |
| **Regeneração** | 1 ponto a cada 5 minutos | Cheia em ~8h (durante o sono) |
| **Custo de trampo T1** | 10-15 NIL | Permite 6-10 trampos por ciclo |
| **Custo de trampo T3** | 25-40 NIL | Permite 2-4 trampos por ciclo |
| **Custo de PvP** | 20 NIL | Limita grinding de PvP |
| **Regen com consumível** | Pingado: +20 NIL (1h cooldown) | Sem custo colateral |
| **Regen com cromo** | Implante Neural Accelerator: +50% regen passiva | Custa 15 Humanidade |

### Por que NIL, não "Stamina"?

- **Diegético**: fadiga neural é um conceito canônico do cyberpunk (sobrecarga de interface)
- **Expansível**: cromo neural aumenta o máximo, criando progressão vertical
- **Monetizável**: estimulantes neurais como premium de conveniência (modelo S&F/KoL)
- **Ritmo**: 8h para recarga completa = 2-3 sessões/dia (padrão ouro do gênero)

### Ciclo Diário do Jogador

```
Manhã (NIL 100) → 4-5 trampos rápidos, checar timers → NIL ~30
Tarde (NIL recarregou) → 2-3 trampos médios, interagir com o bonde → NIL ~20
Noite (NIL recarregou) → PvP, hacking, planejar próximo dia → NIL ~50
Dormir → recarrega para 100
```

---

## 2. Trampos — Sistema de Ações

### Conceito

Trampos são missões oferecidas por despachantes. Cada trampo tem: tier, tipo, requisitos, recompensa, risco. O loop segue as 5 fases do Shadowrun, simplificadas para PBBG.

### Tipos de Trampo

| Tipo | Descrição | Stats relevantes | Exemplo |
|---|---|---|---|
| **Extraction** | Recuperar pessoa, objeto ou dado de local hostil | Body + Reflexes | "Resgatar um engenheiro da Concreta antes que a Aço Paulista o encontre" |
| **Sabotage** | Destruir, desativar ou comprometer infraestrutura | Technical + Intelligence | "Desligar os geradores da fábrica no Setor 7" |
| **Infiltration** | Entrar, obter informação, sair sem ser detectado | Cool + Intelligence | "Copiar os arquivos do servidor da Grupo Falcão no 34° andar" |
| **Wetwork** | Eliminar alvo | Body + Cool | "O CEO da subsidiária está muito curioso. Aposente-o." |
| **Delivery** | Transportar carga sensível de A a B | Reflexes + Cool | "Levar este protótipo de cromo através de 3 postos de controle" |
| **Netrun** | Hackear sistema, extrair dados, plantar vírus | Intelligence + Technical | "Invadir a subnet do Instituto Paraíso e roubar os dados de pesquisa" |
| **Negotiation** | Persuadir, chantagear, negociar | Cool + Moral | "Convencer o chefe de segurança a 'não ver' o carregamento" |

### Estrutura do Trampo (Loop de 5 Fases Simplificado)

| Fase | Ação do Jogador | Timer | Risco |
|---|---|---|---|
| **1. Meet** | Aceitar trampo do despachante (consome NIL para iniciar) | Instantâneo | Nenhum |
| **2. Legwork** | Opcional: comprar info, hackear reconhecimento | 5-30 min | Baixo (gasta NIL, Grana) |
| **3. Execute** | Ação principal. Rolagem de stats vs dificuldade | Instantâneo (mostra resultado) | **Alto**: falha = dano, perda de Grana, heat |
| **4. Escape** | Fuga/extração. Rolagem vs heat/segurança | Instantâneo | Médio: falha = heat, ferimento |
| **5. Wrap Up** | Receber pagamento, cred, consequências | Instantâneo | Nenhum (mas consequências de fases 3-4 se aplicam) |

**Modo Rápido**: jogadores podem pular Legwork e ir direto para Execute, com penalidade de -20% de sucesso.

### Progressão de Dificuldade

| Tier | Nome | Moral necessária | Exemplos | Recompensa (G$) |
|---|---|---|---|---|
| T1 | Bico | 0+ | Entregas, coleta de dívidas, roubo de carro | 500-2.000 |
| T2 | Corre | 5+ | Infiltração simples, hacking básico, proteção | 2.000-8.000 |
| T3 | Esquema | 15+ | Espionagem corporativa, sabotagem, wetwork seletivo | 8.000-30.000 |
| T4 | Golpe | 30+ | Assalto a instalação, extração de alto valor | 30.000-100.000 |
| T5 | Golpe Mestre | 50+ | Heists multi-fase, operações contra megacorps | 100.000+ |

---

## 3. Combate e PvP

### Filosofia

**NÃO é combate em tempo real. É comparação de poder + decisões táticas + timers.** Este é o padrão de TODO o gênero PBBG (The Crims, Torn, OGame, Bitefight) e o que mantém os custos baixos.

### Combate PvE (Trampos)

- **Fórmula de sucesso**: `(Stat relevante + Skill relevante + Bônus de cromo) / Dificuldade do trampo`
- **Modificadores**: Legwork (+20%), Abordagem (Stealth/Assault/Netrun), Consumíveis (+10-30%)
- **Consequência de falha**: dano ao corpo, perda de NIL extra, heat com a facção local

### Combate PvP (Street Fights)

| Parâmetro | Regra |
|---|---|
| **Iniciação** | Atacante gasta 20 NIL. Só pode atacar alvos ±10 níveis |
| **Resolução** | Comparação de stats: `(Body + Reflexes + Poder de Cromo) vs (Body + Reflexes + Poder de Cromo do defensor)` |
| **Modificadores** | Ampolas (+15-30%), bônus de bonde, bônus de território |
| **Vitória** | Vencedor ganha Moral + 10% da Grana em mãos do perdedor |
| **Derrota** | Perdedor perde 5% de Moral + 10% da Grana em mãos. **TETO**: máximo de 3 derrotas/dia com perda |
| **Anti-griefing** | Máximo de 3 ataques ao mesmo jogador por semana. Após isso, eficácia cai para 10% |
| **Guerra de Bondes** | Líder declara guerra a bonde rival (±5 posições no ranking). 24h de duração. Vencedor ganha território temporário |

### Noob Protection
- Jogadores com menos de 7 dias de conta não podem ser atacados
- Jogadores com Moral < 10 perdem apenas 1% em derrotas PvP

---

## 4. Hacking

### Conceito

Hacking é um **sistema paralelo** de progressão — uma segunda camada de gameplay que interage com o loop principal. Não é um minigame isolado.

### A Rede (The Net)

A Rede de São Paulo é fragmentada desde o Apagão de 2075. Ao invés de uma internet global, existem **subnets isoladas**:

| Tipo de Subnet | Localização | Conteúdo | Risco |
|---|---|---|---|
| **Node Público** | Qualquer lugar | Informação básica, boatos, arquivos públicos | Mínimo |
| **Subnet Corporativa** | A Paraíso, O Fervo | Dados de pesquisa, segredos comerciais, blueprints | Alto (trava corporativa) |
| **Subnet de Gangue** | Territórios de gangue | Localização de Saque, planos de ataque, comunicações | Médio |
| **Subnet Fantasma** | As Mortas | Dados pré-Apagão, IA abandonada, segredos perdidos | Muito Alto |
| **O Fundo** | O Ponto | Conteúdo de endgame. Atrás da Porteira. AIs hostis | Extremo |

### Mecânica de Hacking

| Parâmetro | Funcionamento |
|---|---|
| **RAM** | Recurso do Vulto. Determinado pelo Gazuá. Ações de hack consomem RAM. Recarrega 1 RAM/60s |
| **Camadas de trava** | Cada subnet tem camadas de defesa (1-5). Cada camada = 1 encontro de trava |
| **Programas** | Ferramentas de hack ocupam slots (5/7/9 por gazuá). Ex: Pé-de-Cabra (dano), Stealth (bypass), Datamine (Saque extra), Trace (rastrear origem) |
| **Trace** | Cada ação de hack tem traceability. Acumula progresso de trace. Ao estourar → alerta, segurança, contra-ataque |
| **Trava Letal** | Trava letal que causa dano neural. Ocupa 2 slots. Drop raro. Pode ser plantada na SUA rede como defesa |
| **Vírus** | Planta vírus persistente em subnet inimiga. Efeito passivo: -5% eficiência de trampos naquele distrito por 24h |

### Integração com o Loop Principal

```
Hackear subnet corporativa → obter schematics → vender para despachante
Hackear subnet de gangue → descobrir ataque planejado → vender info para gangue rival
Hackear rede de jogador → roubar dados → chantagear ou vender
```

### PvP de Hacking

- **Defesa**: jogador planta trava, Demons, senhas em sua rede pessoal
- **Ataque**: jogador invade rede de outro jogador. Se chegar ao vault, rouba dados/info
- **Risco**: invasor deixa rastro. Defensor pode trace-back e contra-atacar
- **Cooldown**: 48h entre invasões ao mesmo alvo
- **Recompensa**: dados valiosos, localização de Saque, informação para trampos

---

## 5. Sistema de Ampolas (Consumíveis)

Análogo às 14 drogas do The Crims, adaptado para o universo cyberpunk.

### Catálogo de Ampolas

| Ampola | Efeito Principal | Duração | Custo Colateral | Raridade | Preço Base (G$) |
|---|---|---|---|---|---|
| **Pingado** | +20 NIL | Instantâneo | Nenhum (legal) | Comum | 50 |
| **Tranco** | +15% sucesso em trampos de Reflexes | 2h | Tremor (-5% Cool por 1h após) | Comum | 200 |
| **Porrada** | +30 NIL, +10% Body | Instantâneo | Ressaca (-10 NIL máximo por 4h) | Incomum | 500 |
| **Ligado** | +20% sucesso em hacking | 2h | Dor de cabeça (-10% Intelligence por 1h após) | Incomum | 600 |
| **Sumiço** | +30% sucesso em stealth/Cool | 1h | Paranoia (eventos aleatórios de "alarme falso") | Raro | 1.500 |
| **Pancadão** | +50% Body, +30% dano | 30min | -20 Humanidade temporária, risco de evento agressivo | Raro | 2.500 |
| **Brilho** | +40 Moral temporária, social | 3h | Addiction (debuff cumulativo), overdose possível | Raro | 3.000 |
| **Renda Preta** | +100% todos os stats de combate | 15min | -50 Humanidade temporária, 5% de chance de cyberpsychosis | Lendário | 10.000 |

### Mecânica de Vício

- Cada uso de ampola rara+ aumenta um contador de **Addiction**
- Addiction > 20: sintomas de abstinência (-10% todos os stats se não usar ampola em 24h)
- Addiction > 50: overdose risk (5% de chance de apagar ao usar ampola)
- **Detox**: disponível em clínicas (caro, 48h de inatividade). Ou implante Neural Scrubber (-15 Humanidade)

### Regra de Ouro

> **"Todo booster temporário acelera o acúmulo que alimenta o risco de cyberpsychosis. O poder está disponível — o preço é sua humanidade."**

---

## 6. Bondes — Sistema Social

### Formação

- **Tamanho**: 4-6 membros
- **Líder**: jogador que criou o bonde. Único que pode declarar guerras e recrutar
- **Banca**: cada membro escolhe uma banca (Bicho, Vulto, Gambiarrista, Despachante, Socorrista, Estradeiro)

### Bônus de Bonde

| Membros | Bônus |
|---|---|
| 2 | +5% sucesso em trampos cooperativos |
| 3 | +10% de Grana em trampos |
| 4 | +10% Moral |
| 5 | +1 trampo cooperativo por dia |
| 6 | Acesso a trampos de bonde (T3+, requer múltiplas bancas) |

### Guerra de Bondes

- Declarar guerra a bonde rival (±5 posições no ranking)
- Duração: 24h
- Membros podem atacar membros do bonde rival sem restrição de nível
- Vencedor (mais ataques bem-sucedidos): ganha território temporário (+10% Saque no distrito)
- Perdedor: perde 5% de Moral por membro

### Territórios

Cada distrito tem um slot de **Território de Bonde**. O bonde que controla o território ganha:
- +10% recompensa de trampos naquele distrito
- +5% desconto em vendors locais
- Nome do bonde exibido no leaderboard do distrito

Territórios são resetados a cada **2 semanas** (alinhado com a duração da rodada).

---

## 7. Submundo — Sistema de Apostas e Risco

Substitui o "casino" do The Crims com atividades temáticas cyberpunk:

| Atividade | Descrição | Aposta Mínima | Risco |
|---|---|---|---|
| **Rinha dos Anjos de Cromo** | Apostar em lutas de NPCs (gladiadores chromados) | G$ 100 | Médio (resultados pré-determinados mas com variação) |
| **Racha de Drones** | Corridas de drones clandestinas | G$ 500 | Médio-alto (resultados influenciados por eventos do mundo) |
| **Mercado de Dados** | Comprar/vender dados de alto risco | G$ 1.000+ | Alto (informação pode ser falsa, armadilha ou valiosa) |
| **Roleta das Corp** | Investir em ações de corps com base em eventos | G$ 5.000+ | Muito alto (manipulação de mercado por eventos) |

**Regra de house edge**: publicada e auditável. Transparência = confiança (lição do The Crims, que nunca publicou).

---

## 8. Leaderboards e Competição

### Rankings

| Ranking | Métrica | Atualização | Recompensa |
|---|---|---|---|
| **Moral** | Maior Moral | Diária | Título, visibilidade no perfil |
| **Top Trampos** | Mais trampos concluídos (semana) | Semanal | Grana bônus, acesso a despachante exclusivo |
| **Top Bonde** | Maior poder combinado | Semanal | Território prioritário |
| **Vulto Elite** | Mais hacks bem-sucedidos | Semanal | Componente raro de gazuá |
| **Lendas** | Jogadores que atingiram Moral 100 | Permanente | Drink no menu do Saideira |

### Eventos de Temporada

- **Corp War**: evento de 48h. Escolha um lado (Grupo Falcão vs Aço Paulista). Trampos PvP massivos
- **Apagão 2.0**: ataque à infraestrutura. Hacking liberado em todos os distritos
- **Night of the Long Knives**: 24h sem proteção de noob. Alto risco, alta recompensa

---

## 9. Rolê de Gangue — PvE de Gangue

### Conceito

As gangues de São Paulo não pedem licença. Elas ocupam. Cada uma mantém **bocas** — pontos de operação no próprio território: boca de cromo, boca de aposta, boca de arma, boca de dado. Invadir uma boca é invadir o **rolê** da gangue: bater nos seguranças, saquear o estoque e vazar antes do reforço chegar.

PvE contra gangues NPC. Sem tempo real, sem servidor de baixa latência — comparação de poder + decisão + timer, o padrão do gênero. Referência: Hunting Grounds do The Crims (35 raves escaláveis por dia da rodada; 8 bosses com power fixo).

> "Cada gangue tem seu canto. Teu erro é achar que entra sem pagar entrada."

### As Bocas

35 bocas no total, distribuídas pelos territórios das 8 gangues. Babilônia não tem boca — território neutro, trégua tácita. As bocas aparecem no menu do distrito: cada território lista as suas, com poder e recompensa visíveis.

| Gangue | Território | Bocas | Moral mínima | Poder base (dia 1) | Grana base (G$) | Moral | Saque típico |
|---|---|---|---|---|---|---|---|
| **Catadores** | A Quebrada (base) | 4 | 0 | 12 | 500-1.000 | 1-2 | Peça de Sucata |
| **Raiz** | Periferia / cinturão verde | 4 | 5 | 16 | 1.000-2.000 | 1-2 | Muda Sintética |
| **Culto da Estática** | As Mortas | 4 | 10 | 20 | 2.000-4.000 | 2-3 | Fragmento de Estática |
| **Anjos de Cromo** | A Quebrada (superior) | 5 | 15 | 24 | 4.000-8.000 | 2-3 | Cromo Dourado |
| **Os Invisíveis** | A Quebrada (zonas profundas) | 4 | 20 | 28 | 6.000-12.000 | 3-4 | Identidade Descartável |
| **Maré de Ferro** | O Fervo | 5 | 25 | 32 | 10.000-20.000 | 3-4 | Munição de Grau Militar |
| **O Comando** | O Fluxo (submundo) | 5 | 30 | 36 | 15.000-30.000 | 4-5 | Contrato de Proteção |
| **Os Barqueiros** | O Ponto | 4 | 40 | 44 | 25.000-50.000 | 5-6 | Cromo de Necrópole |

**Total: 35 bocas.** Catadores são fracos — catador não é soldado. Os Barqueiros são o fim da linha: ninguém desce no Ponto e volta do mesmo jeito.

### Fórmula de Sucesso

`Chance de sucesso = Poder do jogador / Poder do bando`

- **Poder do jogador** = Body + Reflexes + Poder de Cromo + bônus de ampola (mesma fórmula do PvP)
- **Poder do bando** = Poder base da gangue × Escala do dia
- **Ratio ≥ 1.5**: vitória garantida, recompensa -50%. Sem risco, sem graça (lição do The Crims: power >> dificuldade = ganho diminui)
- **Ratio 0.9-1.1**: zona ideal, recompensa cheia
- **Ratio < 0.6**: derrota quase certa. Não insiste, mano

### Escala por Dia da Rodada

A rodada dura 14 dias. As gangues se preparam — o rolê fica mais pesado a cada dia. Recompensa acompanha o risco.

| Dia da rodada | Multiplicador de Poder | Multiplicador de Recompensa |
|---|---|---|
| 1-2 | 1.0× | 1.0× |
| 3-4 | 1.2× | 1.2× |
| 5-6 | 1.4× | 1.4× |
| 7-8 | 1.6× | 1.6× |
| 9-10 | 1.8× | 1.8× |
| 11-12 | 2.0× | 2.0× |
| 13-14 | 2.2× | 2.2× |

Dia 14, a boca dos Catadores (12) vira 26. A dos Barqueiros (44) vira 97. O fim da rodada é o auge — e o auge paga.

### Recompensas

| Recompensa | Boca | Cabeça |
|---|---|---|
| **Grana** | Tabela das bocas × Escala do dia | Fixa por gangue (10.000-200.000) |
| **Saque** | Componente da gangue (1-3 unidades) | Componente raro + peça de cromo |
| **Moral** | 1-6 (por gangue) | 10-30 |
| **Reputação de gangue** | +rep com o inimigo natural, -rep com a gangue atacada | Dobro do swing da boca |

Saque alimenta crafting (Fase 3) e venda em Babilônia. Componente de gangue é a matéria-prima do cromo de rua.

### Riscos

| Risco | Boca | Cabeça |
|---|---|---|
| **NIL** | 15 | 30 |
| **Dano** | Falha = dano ao corpo | Falha = dano pesado |
| **Heat** | +10 com a gangue | +25 |
| **Prisão** | Não | Falha = 2h de prisão + perda de 10% da Grana em mãos |

**Heat** acumula por gangue. Heat ≥ 50: chance de emboscada no próximo trampo no território dela. Heat 100: a gangue revida — ataque PvP contra você. Heat decai 10/dia.

### As Cabeças (Bosses)

Cada gangue tem uma **Cabeça** — o dono da boca maior, o nome que a gangue respeita. Poder **fixo**, não escala com o dia (referência: Street Fights do The Crims, 8 bosses com power fixo). Conteúdo de bonde: poder somado dos membros. Solo é possível com build de endgame + ampola.

| Gangue | Cabeça | Poder fixo | Desbloqueio | Grana (G$) | Moral | Risco |
|---|---|---|---|---|---|---|
| **Catadores** | Ferro-Velho | 60 | Dia 3, Moral 10 | 10.000-20.000 | 10-15 | Médio |
| **Raiz** | Mata-Viva | 80 | Dia 4, Moral 15 | 15.000-30.000 | 10-15 | Médio |
| **Culto da Estática** | O Coro | 100 | Dia 5, Moral 20 | 20.000-40.000 | 12-18 | Alto |
| **Anjos de Cromo** | Serafim | 120 | Dia 6, Moral 25 | 30.000-60.000 | 12-18 | Alto |
| **Os Invisíveis** | Ninguém | 140 | Dia 7, Moral 30 | 40.000-80.000 | 15-20 | Alto |
| **Maré de Ferro** | Sargento | 160 | Dia 8, Moral 35 | 50.000-100.000 | 15-20 | Muito Alto |
| **O Comando** | O Doutor | 180 | Dia 10, Moral 40 | 75.000-150.000 | 18-25 | Muito Alto |
| **Os Barqueiros** | Caronte | 200 | Dia 12, Moral 50 | 100.000-200.000 | 20-30 | Extremo |

**Vingança**: matar a Cabeça zera o heat dela com você — mas a gangue reage. As bocas dela ficam 2× mais difíceis por 24h.

### Limites Anti-Grind

| Limite | Regra |
|---|---|
| **NIL** | 15 por boca, 30 por Cabeça — teto natural de ~6 bocas/dia |
| **Teto diário** | Máx 8 bocas/dia no total, máx 3 da mesma gangue |
| **Cabeça** | 1 tentativa por gangue por dia (cooldown 24h) |
| **Recompensa decrescente** | Mesma boca 3× no mesmo dia → recompensa -50% |
| **Ratio alto** | Poder ≥ 1.5× o bando → recompensa -50% |

Bocas resetam diariamente. O anti-grind segue o mesmo princípio do PvP: teto de tentativas + recompensa decrescente.

### Reputação de Gangue (issue #88)

PvE de Gangue é a principal fonte de reputação de gangue (Sistema de Reputação, issue #88, Fase 3). Atacar a boca da gangue X dá +rep com o inimigo natural de X e -rep com X:

| Gangue atacada | Ganham rep |
|---|---|
| Catadores | Anjos de Cromo |
| Anjos de Cromo | Catadores |
| Culto da Estática | Os Invisíveis |
| Os Invisíveis | Culto da Estática |
| Os Barqueiros | Raiz |
| Raiz | Os Barqueiros |
| Maré de Ferro | O Comando |
| O Comando | Maré de Ferro |

Rep alta desbloqueia: desconto em vendors da gangue, trampos exclusivos, passagem segura pelo território. Rep baixa: a gangue te trata como alvo.

### Nota de Fase

Rolê de Gangue é **Fase 2** (The Edge), alinhado com Guerra de Bondes e territórios. A integração completa de reputação depende do Sistema de Reputação (#88, Fase 3).
