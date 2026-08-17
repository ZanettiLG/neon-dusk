# Mecânicas Core

## Visão Geral dos Sistemas

Neon Dusk traduz CADA mecânica comprovada dos PBBGs de sucesso (The Crims, Torn, KoL) para o universo cyberpunk. A tabela abaixo mostra o mapeamento completo:

| Mecânica PBBG | The Crims | Neon Dusk | Inspiração (referência) |
|---|---|---|---|
| Energia | Stamina/Tickets | **Neural Interface Load (NIL)** | Cyberware Capacity (2077), RAM (2077) |
| Ações | Crimes/Roubos | **Gigs** (por tier e despachante) | Gigs CP2077, Shadowrun loop 5 fases |
| Consumíveis | Drogas (14) | **Stims** (8 tipos) | Combat drugs TTRPG, glitter |
| Gangues | Gangues | **Crews** (5 bancas + 1 líder) | crew de mercenários |
| Score | Respeito | **Moral** (0-100) | Reputação de rua (CP2077) |
| Treino | Treino/Universidade | **Chrome + Simuladores** | Médicos de chrome (RED), Humanity Cost |
| Economia | $ + Banco + Bolsa | **Grana + Fachadas + Resgate** | Eurodollar, RED Price Categories |
| Casino | Blackjack/Slots/Loteria | **Underground** (arenas, apostas, data-trading) | Anjos de Cromo (arenas), O Comando (cassinos) |

---

## 1. Neural Interface Load (NIL) — Sistema de Energia

### Conceito

Toda ação significativa em São Paulo exige interface neural — seus implantes processam dados, calculam trajetórias, sobrepõem informações no seu campo de visão. Este processamento gera fadiga neural, medida como **Neural Interface Load (NIL)** .

### Funcionamento

| Parâmetro | Valor | Nota |
|---|---|---|
| **NIL máximo base** | 100 | Aumenta com chrome neural (+10 por tier de implante neural) |
| **Regeneração** | 1 ponto a cada 5 minutos | Cheia em ~8h (durante o sono) |
| **Custo de gig T1** | 10-15 NIL | Permite 6-10 gigs por ciclo |
| **Custo de gig T3** | 25-40 NIL | Permite 2-4 gigs por ciclo |
| **Custo de PvP** | 20 NIL | Limita grinding de PvP |
| **Regen com consumível** | Syn-café: +20 NIL (1h cooldown) | Sem custo colateral |
| **Regen com chrome** | Implante Neural Accelerator: +50% regen passiva | Custa 15 Humanidade |

### Por que NIL, não "Stamina"?

- **Diegético**: fadiga neural é um conceito canônico do cyberpunk (sobrecarga de interface)
- **Expansível**: chrome neural aumenta o máximo, criando progressão vertical
- **Monetizável**: estimulantes neurais como premium de conveniência (modelo S&F/KoL)
- **Ritmo**: 8h para recarga completa = 2-3 sessões/dia (padrão ouro do gênero)

### Ciclo Diário do Jogador

```
Manhã (NIL 100) → 4-5 gigs rápidos, checar timers → NIL ~30
Tarde (NIL recarregou) → 2-3 gigs médios, interagir com crew → NIL ~20
Noite (NIL recarregou) → PvP, hacking, planejar próximo dia → NIL ~50
Dormir → recarrega para 100
```

---

## 2. Gigs — Sistema de Ações

### Conceito

Gigs são missões oferecidas por despachantes. Cada gig tem: tier, tipo, requisitos, recompensa, risco. O loop segue as 5 fases do Shadowrun, simplificadas para PBBG.

### Tipos de Gig

| Tipo | Descrição | Stats relevantes | Exemplo |
|---|---|---|---|
| **Extraction** | Recuperar pessoa, objeto ou dado de local hostil | Body + Reflexes | "Resgatar um engenheiro da Concreta antes que a Aço Paulista o encontre" |
| **Sabotage** | Destruir, desativar ou comprometer infraestrutura | Technical + Intelligence | "Desligar os geradores da fábrica no Setor 7" |
| **Infiltration** | Entrar, obter informação, sair sem ser detectado | Cool + Intelligence | "Copiar os arquivos do servidor da Grupo Falcão no 34° andar" |
| **Wetwork** | Eliminar alvo | Body + Cool | "O CEO da subsidiária está muito curioso. Aposente-o." |
| **Delivery** | Transportar carga sensível de A a B | Reflexes + Cool | "Levar este protótipo de chrome através de 3 postos de controle" |
| **Netrun** | Hackear sistema, extrair dados, plantar vírus | Intelligence + Technical | "Invadir a subnet do Instituto Paraíso e roubar os dados de pesquisa" |
| **Negotiation** | Persuadir, chantagear, negociar | Cool + Moral | "Convencer o chefe de segurança a 'não ver' o carregamento" |

### Estrutura do Gig (Loop de 5 Fases Simplificado)

| Fase | Ação do Jogador | Timer | Risco |
|---|---|---|---|
| **1. Meet** | Aceitar gig do despachante (consome NIL para iniciar) | Instantâneo | Nenhum |
| **2. Legwork** | Opcional: comprar info, hackear reconhecimento | 5-30 min | Baixo (gasta NIL, Grana) |
| **3. Execute** | Ação principal. Rolagem de stats vs dificuldade | Instantâneo (mostra resultado) | **Alto**: falha = dano, perda de Grana, heat |
| **4. Escape** | Fuga/extração. Rolagem vs heat/segurança | Instantâneo | Médio: falha = heat, ferimento |
| **5. Wrap Up** | Receber pagamento, cred, consequências | Instantâneo | Nenhum (mas consequências de fases 3-4 se aplicam) |

**Modo Rápido**: jogadores podem pular Legwork e ir direto para Execute, com penalidade de -20% de sucesso.

### Progressão de Dificuldade

| Tier | Nome | Moral necessária | Exemplos | Recompensa (G$) |
|---|---|---|---|---|
| T1 | Street Level | 0+ | Entregas, coleta de dívidas, roubo de carro | 500-2.000 |
| T2 | Runner | 5+ | Infiltração simples, hacking básico, proteção | 2.000-8.000 |
| T3 | Pro | 15+ | Espionagem corporativa, sabotagem, wetwork seletivo | 8.000-30.000 |
| T4 | Elite | 30+ | Assalto a instalação, extração de alto valor | 30.000-100.000 |
| T5 | Legend | 50+ | Heists multi-fase, operações contra megacorps | 100.000+ |

---

## 3. Combate e PvP

### Filosofia

**NÃO é combate em tempo real. É comparação de poder + decisões táticas + timers.** Este é o padrão de TODO o gênero PBBG (The Crims, Torn, OGame, Bitefight) e o que mantém os custos baixos.

### Combate PvE (Gigs)

- **Fórmula de sucesso**: `(Stat relevante + Skill relevante + Bônus de chrome) / Dificuldade do gig`
- **Modificadores**: Legwork (+20%), Abordagem (Stealth/Assault/Netrun), Consumíveis (+10-30%)
- **Consequência de falha**: dano ao corpo, perda de NIL extra, heat com a facção local

### Combate PvP (Street Fights)

| Parâmetro | Regra |
|---|---|
| **Iniciação** | Atacante gasta 20 NIL. Só pode atacar alvos ±10 níveis |
| **Resolução** | Comparação de stats: `(Body + Reflexes + Chrome Power) vs (Body + Reflexes + Chrome Power do defensor)` |
| **Modificadores** | Stims (+15-30%), bônus de crew, bônus de território |
| **Vitória** | Vencedor ganha Moral + 10% da Grana em mãos do perdedor |
| **Derrota** | Perdedor perde 5% de Moral + 10% da Grana em mãos. **TETO**: máximo de 3 derrotas/dia com perda |
| **Anti-griefing** | Máximo de 3 ataques ao mesmo jogador por semana. Após isso, eficácia cai para 10% |
| **Crew Wars** | Líder declara guerra a crew rival (±5 posições no ranking). 24h de duração. Vencedor ganha território temporário |

### Noob Protection
- Jogadores com menos de 7 dias de conta não podem ser atacados
- Jogadores com Moral < 10 perdem apenas 1% em derrotas PvP

---

## 4. Hacking

### Conceito

Hacking é um **sistema paralelo** de progressão — uma segunda camada de gameplay que interage com o loop principal. Não é um minigame isolado.

### A Rede (The Net)

A Rede de São Paulo é fragmentada desde o Blackout de 2075. Ao invés de uma internet global, existem **subnets isoladas**:

| Tipo de Subnet | Localização | Conteúdo | Risco |
|---|---|---|---|
| **Node Público** | Qualquer lugar | Informação básica, boatos, arquivos públicos | Mínimo |
| **Subnet Corporativa** | A Paraíso, O Fervo | Dados de pesquisa, segredos comerciais, blueprints | Alto (ICE corporativo) |
| **Subnet de Gangue** | Territórios de gangue | Localização de loot, planos de ataque, comunicações | Médio |
| **Subnet Fantasma** | As Mortas | Dados pré-Blackout, IA abandonada, segredos perdidos | Muito Alto |
| **Deep Net** | O Ponto | Conteúdo de endgame. Atrás da Porteira. AIs hostis | Extremo |

### Mecânica de Hacking

| Parâmetro | Funcionamento |
|---|---|
| **RAM** | Recurso do Vulto. Determinado pelo Gazuá. Ações de hack consomem RAM. Recarrega 1 RAM/60s |
| **ICE Layers** | Cada subnet tem camadas de defesa (1-5). Cada camada = 1 encontro de ICE |
| **Programas** | Ferramentas de hack ocupam slots (5/7/9 por gazuá). Ex: ICEbreaker (dano), Stealth (bypass), Datamine (loot extra), Trace (rastrear origem) |
| **Trace** | Cada ação de hack tem traceability. Acumula progresso de trace. Ao estourar → alerta, segurança, contra-ataque |
| **Black ICE** | ICE letal que causa dano neural. Ocupa 2 slots. Drop raro. Pode ser plantado na SUA rede como defesa |
| **Vírus** | Planta vírus persistente em subnet inimiga. Efeito passivo: -5% eficiência de gigs naquele distrito por 24h |

### Integração com o Loop Principal

```
Hackear subnet corporativa → obter schematics → vender para despachante
Hackear subnet de gangue → descobrir ataque planejado → vender info para gangue rival
Hackear rede de jogador → roubar dados → chantagear ou vender
```

### PvP de Hacking

- **Defesa**: jogador planta ICE, Demons, senhas em sua rede pessoal
- **Ataque**: jogador invade rede de outro jogador. Se chegar ao vault, rouba dados/info
- **Risco**: invasor deixa rastro. Defensor pode trace-back e contra-atacar
- **Cooldown**: 48h entre invasões ao mesmo alvo
- **Recompensa**: dados valiosos, localização de loot, informação para gigs

---

## 5. Sistema de Stims (Consumíveis)

Análogo às 14 drogas do The Crims, adaptado para o universo cyberpunk.

### Catálogo de Stims

| Stim | Efeito Principal | Duração | Custo Colateral | Raridade | Preço Base (G$) |
|---|---|---|---|---|---|
| **Syn-café** | +20 NIL | Instantâneo | Nenhum (legal) | Comum | 50 |
| **Reflex** | +15% sucesso em gigs de Reflexes | 2h | Tremor (-5% Cool por 1h após) | Comum | 200 |
| **AdrenaStim** | +30 NIL, +10% Body | Instantâneo | Burnout (-10 NIL máximo por 4h) | Incomum | 500 |
| **Cortex+** | +20% sucesso em hacking | 2h | Dor de cabeça (-10% Intelligence por 1h após) | Incomum | 600 |
| **Ghost** | +30% sucesso em stealth/Cool | 1h | Paranoia (eventos aleatórios de "alarme falso") | Raro | 1.500 |
| **Pancadão** | +50% Body, +30% dano | 30min | -20 Humanidade temporária, risco de evento agressivo | Raro | 2.500 |
| **Glitter** | +40 Moral temporária, social | 3h | Addiction (debuff cumulativo), overdose possível | Raro | 3.000 |
| **Black Lace** | +100% todos os stats de combate | 15min | -50 Humanidade temporária, 5% de chance de cyberpsychosis | Lendário | 10.000 |

### Mecânica de Vício

- Cada uso de stim raro+ aumenta um contador de **Addiction**
- Addiction > 20: sintomas de abstinência (-10% todos os stats se não usar stim em 24h)
- Addiction > 50: overdose risk (5% de chance de flatline ao usar stim)
- **Detox**: disponível em clínicas (caro, 48h de inatividade). Ou implante Neural Scrubber (-15 Humanidade)

### Regra de Ouro

> **"Todo booster temporário acelera o acúmulo que alimenta o risco de cyberpsychosis. O poder está disponível — o preço é sua humanidade."**

---

## 6. Crews — Sistema Social

### Formação

- **Tamanho**: 4-6 membros
- **Líder**: jogador que criou a crew. Único que pode declarar guerras e recrutar
- **Banca**: cada membro escolhe uma banca (Bicho, Vulto, Gambiarrista, Despachante, Socorrista, Estradeiro)

### Bônus de Crew

| Membros | Bônus |
|---|---|
| 2 | +5% sucesso em gigs cooperativos |
| 3 | +10% de Grana em gigs |
| 4 | +10% Moral |
| 5 | +1 gig cooperativo por dia |
| 6 | Acesso a gigs de crew (T3+, requer múltiplas bancas) |

### Crew Wars

- Declarar guerra a crew rival (±5 posições no ranking)
- Duração: 24h
- Membros podem atacar membros da crew rival sem restrição de nível
- Vencedor (mais ataques bem-sucedidos): ganha território temporário (+10% loot no distrito)
- Perdedor: perde 5% de Moral por membro

### Territórios

Cada distrito tem um slot de **Território de Crew**. A crew que controla o território ganha:
- +10% recompensa de gigs naquele distrito
- +5% desconto em vendors locais
- Nome da crew exibido no leaderboard do distrito

Territórios são resetados a cada **2 semanas** (alinhado com a duração da rodada).

---

## 7. Underground — Sistema de Apostas e Risco

Substitui o "casino" do The Crims com atividades temáticas cyberpunk:

| Atividade | Descrição | Aposta Mínima | Risco |
|---|---|---|---|
| **Fight Pit** | Apostar em lutas de NPCs (Anjos de Cromo, gladiadores chromados) | G$ 100 | Médio (resultados pré-determinados mas com variação) |
| **Drone Races** | Corridas de drones clandestinas | G$ 500 | Médio-alto (resultados influenciados por eventos do mundo) |
| **Data-Trading** | Comprar/vender dados de alto risco | G$ 1.000+ | Alto (informação pode ser falsa, armadilha ou valiosa) |
| **Corporate Roulette** | Investir em ações de corps com base em eventos | G$ 5.000+ | Muito alto (manipulação de mercado por eventos) |

**Regra de house edge**: publicada e auditável. Transparência = confiança (lição do The Crims, que nunca publicou).

---

## 8. Leaderboards e Competição

### Rankings

| Ranking | Métrica | Atualização | Recompensa |
|---|---|---|---|
| **Moral** | Maior Moral | Diária | Título, visibilidade no perfil |
| **Top Gigs** | Mais gigs concluídos (semana) | Semanal | Grana bônus, acesso a despachante exclusivo |
| **Top Crew** | Maior poder combinado | Semanal | Território prioritário |
| **Vulto Elite** | Mais hacks bem-sucedidos | Semanal | Componente raro de gazuá |
| **Lendas** | Jogadores que atingiram Moral 100 | Permanente | Drink no menu do Saideira |

### Eventos de Temporada

- **Corp War**: evento de 48h. Escolha um lado (Grupo Falcão vs Aço Paulista). Gigs PvP massivos
- **Blackout 2.0**: ataque à infraestrutura. Hacking liberado em todos os distritos
- **Night of the Long Knives**: 24h sem proteção de noob. Alto risco, alta recompensa
